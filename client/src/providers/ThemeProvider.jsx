import { createContext, use, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const KEY = 'theme';

function storedTheme() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

// index.html sets data-theme before first paint (dark unless the visitor picked light); this keeps React in step.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || storedTheme() || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggle: () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        try {
          localStorage.setItem(KEY, next);
        } catch {
          // Not persisted, but still applied for this visit.
        }
        // Stamp the attribute before re-rendering: useThemeColors reads the CSS variables during render,
        // so an effect (which runs after render) would hand canvases the previous theme's colours.
        document.documentElement.dataset.theme = next;
        setTheme(next);
      },
    }),
    [theme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export const useTheme = () => use(ThemeContext);

// Canvas and chart code can't read CSS classes, so give it the resolved token colours for the current theme.
export function useThemeColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const get = (name) => css.getPropertyValue(`--color-${name}`).trim();
    return {
      theme,
      bg: get('bg'),
      plate: get('plate'),
      seam: get('seam'),
      edge: get('edge'),
      ink3: get('ink-3'),
      accent: get('accent'),
      accentInk: get('accent-ink'),
      neon: get('neon'),
    };
  }, [theme]);
}
