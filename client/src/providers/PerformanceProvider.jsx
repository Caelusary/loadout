import { createContext, use, useEffect, useMemo, useState } from 'react';

// Performance mode: photos instead of 3D models, no animated neon backdrop, and a lighter cursor.
// Off unless chosen; a device that looks slow is offered it once (see PerformanceSuggestion). The
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

export function PerformanceProvider({ children }) {
  const [choice, setChoice] = useState(stored);
  const on = choice === 'on';

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
