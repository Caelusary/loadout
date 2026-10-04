import { CheckCircle, Warning } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';

// Background removal runs in the seller's browser (@imgly/background-removal, loaded only here).
// The first run downloads the model once (roughly 40 MB); after that the browser caches it.
const CONFIG = { model: 'isnet_quint8', output: { format: 'image/webp', quality: 0.9 } };
const MAX_BYTES = 2 * 1024 * 1024; // matches the server's image limit

const CHECKER =
  'bg-[length:16px_16px] bg-[conic-gradient(var(--color-raised)_25%,var(--color-plate)_0_50%,var(--color-raised)_0_75%,var(--color-plate)_0)]';

const cutoutName = (file) => `${file.name.replace(/\.[^.]+$/, '')}-cutout.webp`;

// Shows each picked photo next to its background-removed cutout. The cutout is chosen by default;
// the seller can keep the original instead (cutouts can clip cables or clear plastic).
export function CutoutReview({ files, onDone, onCancel }) {
  const [items, setItems] = useState(() => files.map((file) => ({ file, original: URL.createObjectURL(file), status: 'working', useCutout: true })));
  const [download, setDownload] = useState(null); // model download progress, 0..1, first run only
  // Object URLs are released when the review ends, not in the effect cleanup: Strict Mode runs that
  // cleanup right after mount in development, which would blank the previews.
  const urls = useRef(items.map((i) => i.original));
  const finish = (callback) => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    callback();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let removeBackground;
      try {
        ({ removeBackground } = await import('@imgly/background-removal'));
      } catch {
        if (!cancelled) setItems((list) => list.map((i) => ({ ...i, status: 'failed', useCutout: false })));
        return;
      }
      const progress = (key, current, total) => {
        if (key.startsWith('fetch:') && total) setDownload(current >= total ? null : current / total);
      };
      for (let n = 0; n < files.length; n += 1) {
        if (cancelled) return;
        let patch;
        try {
          const blob = await removeBackground(files[n], { ...CONFIG, progress });
          const cutout = new File([blob], cutoutName(files[n]), { type: 'image/webp' });
          const url = URL.createObjectURL(blob);
          urls.current.push(url);
          patch = cutout.size > MAX_BYTES ? { status: 'failed', useCutout: false } : { status: 'ready', cutout, cutoutUrl: url };
        } catch {
          patch = { status: 'failed', useCutout: false };
        }
        if (!cancelled) setItems((list) => list.map((item, i) => (i === n ? { ...item, ...patch } : item)));
      }
      if (!cancelled) setDownload(null);
    })();
    return () => {
      cancelled = true;
    };
    // Runs once for the files this review was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the page mid-review: release the previews. Deferred a tick so Strict Mode's instant
  // remount in development (which cancels this timer) doesn't blank them.
  const revokeTimer = useRef(0);
  useEffect(() => {
    clearTimeout(revokeTimer.current);
    const list = urls.current;
    return () => {
      revokeTimer.current = setTimeout(() => list.forEach((u) => URL.revokeObjectURL(u)), 0);
    };
  }, []);

  const working = items.some((i) => i.status === 'working');
  const choose = (n, useCutout) => setItems((list) => list.map((item, i) => (i === n ? { ...item, useCutout } : item)));

  return (
    <div className="flex flex-col gap-4 rounded-panel border border-seam bg-plate p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">Remove backgrounds</h3>
        <p className="text-[13px] text-ink-3" aria-live="polite">
          {download != null
            ? `Getting the background remover ready… ${Math.round(download * 100)}% (first time only)`
            : working
              ? 'Removing backgrounds…'
              : 'Pick the version to upload for each photo.'}
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {items.map((item, n) => (
          <li key={item.original} className="grid gap-3 sm:grid-cols-2">
            <Choice label="Original" selected={!item.useCutout} onSelect={() => choose(n, false)}>
              <img src={item.original} alt="" className="size-full object-contain" />
            </Choice>
            <Choice
              label="Background removed"
              selected={item.useCutout}
              disabled={item.status !== 'ready'}
              onSelect={() => choose(n, true)}
              checker
            >
              {item.status === 'ready' && <img src={item.cutoutUrl} alt="" className="size-full object-contain" />}
              {item.status === 'working' && <span className="size-full animate-pulse bg-raised/60" />}
              {item.status === 'failed' && (
                <span className="flex flex-col items-center gap-2 px-4 text-center text-[13px] text-ink-2">
                  <Warning size={20} className="text-warn" />
                  Couldn&apos;t remove this background. The original will be used.
                </span>
              )}
            </Choice>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => finish(onCancel)}>
          Cancel
        </Button>
        <Button
          loading={working}
          disabled={working}
          onClick={() => {
            const chosen = items.map((i) => (i.useCutout && i.cutout ? i.cutout : i.file));
            finish(() => onDone(chosen));
          }}
        >
          Upload {items.length} {items.length === 1 ? 'photo' : 'photos'}
        </Button>
      </div>
    </div>
  );
}

function Choice({ label, selected, disabled = false, checker = false, onSelect, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className="group flex flex-col gap-2 text-left disabled:cursor-not-allowed"
    >
      <span
        className={`grid aspect-[4/3] place-items-center overflow-hidden rounded-control border-2 transition-colors ${checker ? CHECKER : 'bg-raised'} ${
          selected ? 'border-accent-ink' : 'border-seam group-enabled:group-hover:border-edge'
        }`}
      >
        {children}
      </span>
      <span className={`flex items-center gap-1.5 text-[13px] ${selected ? 'text-ink' : 'text-ink-3'}`}>
        {selected && <CheckCircle size={15} weight="fill" className="text-accent-ink" />}
        {label}
      </span>
    </button>
  );
}
