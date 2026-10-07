import { Gauge, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { usePerformance } from '../../providers/PerformanceProvider.jsx';

const DISMISSED = 'loadout:performance-asked';
const SAMPLE_MS = 2000;

// What the browser reports up front: very little memory, very few cores, or data saver on.
function looksSlow() {
  const { deviceMemory, hardwareConcurrency, connection } = navigator;
  return (deviceMemory > 0 && deviceMemory <= 2) || (hardwareConcurrency > 0 && hardwareConcurrency <= 2) || Boolean(connection?.saveData);
}

// Counts frames for two seconds once the page has settled; a device that can't keep up with the
// effects shows it here.
function measureFps() {
  return new Promise((resolve) => {
    let frames = 0;
    let start = 0;
    const step = (t) => {
      if (!start) start = t;
      frames += 1;
      if (t - start < SAMPLE_MS) requestAnimationFrame(step);
      else resolve((frames * 1000) / (t - start));
    };
    requestAnimationFrame(step);
  });
}

const dismissed = () => {
  try {
    return localStorage.getItem(DISMISSED) === '1';
  } catch {
    return false;
  }
};

// Offers Performance mode once, on a device that looks or runs slow, to anyone who hasn't chosen yet.
export function PerformanceSuggestion() {
  const perf = usePerformance();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (perf.decided || dismissed()) return;
    let cancelled = false;
    const check = async () => {
      // A hidden tab doesn't draw frames, so only measure while it's in view.
      if (document.visibilityState !== 'visible') return;
      const slow = looksSlow() || (await measureFps()) < 40;
      if (!cancelled && slow) setShow(true);
    };
    const id = setTimeout(check, 4000);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [perf.decided]);

  if (!show || perf.decided) return null;
  const close = () => {
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      // asked again next visit; harmless
    }
    setShow(false);
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(var(--dock)+0.75rem)] z-40 mx-auto flex max-w-md items-start gap-3 rounded-panel border border-seam bg-plate p-4 shadow-[0_12px_32px_-16px_rgb(0_0_0/0.6)] transition-[opacity,translate] duration-200 ease-out starting:translate-y-2 starting:opacity-0 sm:right-6 sm:left-auto sm:mx-0"
    >
      <Gauge size={22} className="mt-0.5 shrink-0 text-accent-ink" />
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">Running slowly?</span> Performance mode swaps the 3D models for photos and
          turns off the animated background.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              perf.set(true);
              close();
            }}
          >
            Turn on
          </Button>
          <Button size="sm" variant="ghost" onClick={close}>
            Not now
          </Button>
        </div>
      </div>
      <button type="button" onClick={close} aria-label="Dismiss" className="-m-1 grid size-8 place-items-center rounded-control text-ink-3 hover:text-ink">
        <X size={16} />
      </button>
    </div>
  );
}
