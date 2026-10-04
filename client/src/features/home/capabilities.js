import { useEffect, useState, useSyncExternalStore } from 'react';

let webgl2;
// WebGL 2 and no data-saver: otherwise the hero falls back to the CSS stack of product shots.
export function canRender3D() {
  if (typeof window === 'undefined') return false;
  if (navigator.connection?.saveData) return false;
  if (webgl2 === undefined) {
    try {
      webgl2 = Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

// True while the element is on screen and the tab is visible; the 3D scene stops rendering otherwise.
export function useActiveOnScreen(ref) {
  const [onScreen, setOnScreen] = useState(true);
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      rootMargin: '100px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return onScreen && visible;
}
