import { CaretLeft, CaretRight, X } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { assetUrl } from '../../lib/api.js';

// A review's photos as small tiles; tapping one opens it large, with arrows when there's more than one.
export function PhotoStrip({ photos, owner }) {
  const dialog = useRef(null);
  const [shown, setShown] = useState(0);
  if (!photos?.length) return null;
  const step = (by) => setShown((i) => (i + by + photos.length) % photos.length);

  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label={`Photos from ${owner}`}>
        {photos.map((url, i) => (
          <li key={url}>
            <button
              type="button"
              onClick={() => {
                setShown(i);
                dialog.current.showModal();
              }}
              aria-label={`Open photo ${i + 1} of ${photos.length}`}
              className="block size-20 overflow-hidden rounded-control border border-seam bg-raised"
            >
              <img src={assetUrl(url)} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        aria-label={`Photo from ${owner}`}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        onKeyDown={(e) =>
          photos.length > 1 && (e.key === 'ArrowRight' ? step(1) : e.key === 'ArrowLeft' && step(-1))
        }
        className="m-auto max-h-[92dvh] w-[min(48rem,96vw)] rounded-panel border border-seam bg-plate p-0 text-ink backdrop:bg-black/70"
      >
        <div className="relative grid place-items-center bg-bg">
          <img
            src={assetUrl(photos[shown])}
            alt={`Photo ${shown + 1} of ${photos.length} from ${owner}`}
            className="max-h-[88dvh] w-full object-contain"
          />
          <button
            type="button"
            onClick={() => dialog.current.close()}
            aria-label="Close photo"
            className="absolute top-2 right-2 grid size-10 place-items-center rounded-full border border-seam bg-plate/90 text-ink-2 hover:text-ink"
          >
            <X size={18} />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="absolute top-1/2 left-2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-seam bg-plate/90 text-ink-2 hover:text-ink"
              >
                <CaretLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-seam bg-plate/90 text-ink-2 hover:text-ink"
              >
                <CaretRight size={18} />
              </button>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
