import { createContext, use, useEffect, useMemo, useState } from 'react';

// Lite mode (named Performance mode in code): photos instead of 3D models, no animated neon backdrop, and a lighter cursor.
// Off unless chosen or the device asks for less; a device that looks slow is offered it once (see PerformanceSuggestion). The
// choice is kept on this device.
const PerformanceContext = createContext(null);
const KEY = 'loadout:performance'; // 'on' | 'off', absent until the visitor chooses

function stored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// A device that has already asked for less (reduce motion, or data saver) starts in Lite mode, and so does a phone
// with 4 GB of memory or less, where the 3D models stutter; picking either way in the toggle overrides it.
// deviceMemory is Chromium-only, so other phones keep 3D and still get the slow-device offer.
function deviceAsksForLess() {
  try {
    const lowMemoryPhone = navigator.deviceMemory > 0 && navigator.deviceMemory <= 4 && matchMedia('(pointer: coarse)').matches;
    return (
      matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(navigator.connection?.saveData) || lowMemoryPhone
    );
  } catch {
    return false;
  }
}

export function PerformanceProvider({ children }) {
  const [choice, setChoice] = useState(stored);
  const [asksForLess] = useState(deviceAsksForLess);
  const on = choice === 'on' || (choice === null && asksForLess);

  // Lets CSS tone down effects too (the cursor's glow and click pulse).
  useEffect(() => {
    if (on) document.documentElement.dataset.performance = 'on';
    else delete document.documentElement.dataset.performance;
  }, [on]);

  const value = useMemo(() => {
    const set = (next) => {
      try {
        localStorage.setItem(KEY, next ? 'on' : 'off');
      } catch {
        // Not remembered, but still applied for this visit.
      }
      setChoice(next ? 'on' : 'off');
    };
    return {
      on,
      // True once the visitor has picked either way, so the suggestion never comes back.
      decided: choice === 'on' || choice === 'off',
      set,
      toggle: () => set(!on),
    };
  }, [on, choice]);

  return <PerformanceContext value={value}>{children}</PerformanceContext>;
}

export const usePerformance = () => use(PerformanceContext);
