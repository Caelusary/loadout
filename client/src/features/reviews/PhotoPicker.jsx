import { Camera, X } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { api, assetUrl } from '../../lib/api.js';
import { shrinkPhoto } from '../../lib/shrinkPhoto.js';
import { MAX_REVIEW_PHOTOS as MAX_PHOTOS } from '../../lib/constants.js';

async function upload(file) {
  const form = new FormData();
  form.append('file', await shrinkPhoto(file));
  const { url } = await api('/reviews/photos', { method: 'POST', form });
  return url;
}

// Up to three photos for a review. They upload as they're picked; the review keeps just the addresses.
export function PhotoPicker({ value, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState('');
  const room = MAX_PHOTOS - value.length;

  const pick = async (files) => {
    // Copy the files before clearing the input: clearing it empties the same list.
    const chosen = [...files].slice(0, room);
    input.current.value = '';
    if (!chosen.length) return;
    setError('');
    setBusy(chosen.length);
    const added = [];
    for (const file of chosen) {
      try {
        added.push(await upload(file));
      } catch (err) {
        setError(err.message || "That photo couldn't be read. Try a JPG or PNG.");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (added.length) onChange([...value, ...added]);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-ink-2">
        Photos <span className="font-normal text-ink-3">(optional, up to {MAX_PHOTOS})</span>
      </p>
      <ul className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <li key={url} className="relative">
            <img
              src={assetUrl(url)}
              alt={`Photo ${i + 1} of your review`}
              className="size-20 rounded-control border border-seam object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border border-seam bg-plate text-ink-2 hover:text-bad"
            >
              <X size={12} weight="bold" />
            </button>
          </li>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <li
            key={`busy-${i}`}
            className="grid size-20 place-items-center rounded-control border border-seam bg-raised"
            aria-label="Uploading"
          >
            <span
              className="size-5 animate-spin rounded-full border-2 border-ink-3 border-t-transparent"
              aria-hidden="true"
            />
          </li>
        ))}
        {room - busy > 0 && (
          <li>
            <button
              type="button"
              onClick={() => input.current.click()}
              className="flex size-20 flex-col items-center justify-center gap-1 rounded-control border border-dashed border-seam text-[12px] text-ink-2 transition-colors hover:border-accent-ink hover:text-accent-ink"
            >
              <Camera size={20} />
              Add
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose review photos"
        onChange={(e) => pick(e.target.files)}
      />
      {error && <p className="text-[13px] text-bad">{error}</p>}
    </div>
  );
}
