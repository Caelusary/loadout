import { Lightning, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { usePerformance } from '../../providers/PerformanceProvider.jsx';

const DISMISSED = 'loadout:performance-asked';
const SAMPLE_MS = 2000;

// What the browser reports up front: very little memory, very few cores, or data saver on.
function looksSlow() {
  const { deviceMemory, hardwareConcurrency, connection } = navigator;
  return (
    (deviceMemory > 0 && deviceMemory <= 2) ||
    (hardwareConcurrency > 0 && hardwareConcurrency <= 2) ||
    Boolean(connection?.saveData)
  );
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

// Offers Lite mode once, on a device that looks or runs slow, to anyone who hasn't chosen yet.
// A device that already looks slow gets it in the first paint, so nothing moves; one found slow by the
// frame count later slides it open instead, and it slides shut again, so the page never jumps.
export function PerformanceSuggestion() {
  const perf = usePerformance();
  const [phase, setPhase] = useState(() =>
    !perf.decided && !dismissed() && looksSlow() ? 'open' : 'hidden',
  );

  useEffect(() => {
    if (phase !== 'hidden' || perf.decided || dismissed()) return;
    let cancelled = false;
    const check = async () => {
      // A hidden tab doesn't draw frames, so only measure while it's in view.
      if (document.visibilityState !== 'visible') return;
      const slow = (await measureFps()) < 40;
      if (!cancelled && slow) setPhase('opening');
    };
    const id = setTimeout(check, 4000);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [phase, perf.decided]);

  if (phase === 'hidden') return null;
  // Choosing Lite mode anywhere else (the header switch) closes it too.
  const leaving = phase === 'closing' || perf.decided;
  const close = () => {
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      // asked again next visit; harmless
    }
    setPhase('closing');
  };

  // A strip under the header, the same form as the delivery check, so it never covers the page.
  return (
    <div
      aria-hidden={leaving || undefined}
      onTransitionEnd={(e) => e.target === e.currentTarget && leaving && setPhase('hidden')}
      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
        leaving
          ? 'grid-rows-[0fr]'
          : phase === 'opening'
            ? 'grid-rows-[1fr] starting:grid-rows-[0fr]'
            : 'grid-rows-[1fr]'
      }`}
    >
      <section role="status" aria-label="Lite mode" className="min-h-0 overflow-hidden bg-accent/10">
        <div className="border-b border-accent-ink/40">
          <div className="mx-auto flex w-full max-w-[1280px] items-start gap-3 px-4 py-3 sm:px-6 lg:items-center">
            <Lightning
              size={22}
              weight="fill"
              className="mt-2.5 shrink-0 text-accent-ink lg:mt-0"
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <p className="pt-2.5 text-sm text-ink-2 lg:pt-0">
                <span className="font-medium text-ink">Running slowly?</span> Lite mode swaps the 3D models
                for photos and turns off the animated background.
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
            <button
              type="button"
              onClick={close}
              aria-label="Dismiss"
              className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-control text-ink-3 hover:text-ink lg:mt-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
