import { ArrowsClockwise, Camera, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { api, assetUrl } from '../../lib/api.js';
import { shrinkPhoto } from '../../lib/shrinkPhoto.js';
import { useToast } from '../../providers/ToastProvider.jsx';

// The rider's photo at the door, for a delivery or a missed one. One fixed frame for every state, so the dialog
// doesn't change size when the photo lands. `missing` marks the box when the rider tried to go on without one: the
// message sits in the box itself, since a toast would land behind the dialog's backdrop.
export function ProofPhoto({ photo, onPhoto, missing = false }) {
  const toast = useToast();
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (file) => {
    input.current.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', await shrinkPhoto(file));
      onPhoto((await api('/deliveries/proof', { method: 'POST', form })).url);
    } catch (err) {
      toast.error(err.message || "That photo couldn't be read. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {photo ? (
        <div className="relative aspect-[16/10] max-h-56 w-full overflow-hidden rounded-control border border-seam bg-bg">
          <img src={assetUrl(photo)} alt="Your photo at the door" className="size-full object-cover" />
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 text-[12px] font-medium text-ok backdrop-blur-sm">
            <CheckCircle size={14} weight="fill" aria-hidden="true" /> Photo added
          </span>
          <button
            type="button"
            onClick={() => input.current.click()}
            disabled={uploading}
            className="absolute right-2 bottom-2 inline-flex h-9 items-center gap-1.5 rounded-control bg-bg/80 px-3 text-[13px] font-medium text-ink backdrop-blur-sm hover:bg-bg disabled:opacity-60"
          >
            <ArrowsClockwise size={16} aria-hidden="true" className={uploading ? 'animate-spin' : ''} />
            {uploading ? 'Uploading…' : 'Retake'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current.click()}
          disabled={uploading}
          aria-invalid={missing || undefined}
          className={`flex aspect-[16/10] max-h-56 w-full flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed bg-raised/50 transition-colors disabled:opacity-60 ${missing ? 'border-bad text-bad' : 'border-edge text-ink-2 hover:border-accent-ink hover:text-accent-ink'}`}
        >
          {missing && !uploading ? (
            <WarningCircle size={32} aria-hidden="true" />
          ) : (
            <Camera size={32} aria-hidden="true" className={uploading ? 'animate-pulse' : ''} />
          )}
          <span className="text-sm font-medium">{uploading ? 'Uploading…' : 'Take photo'}</span>
          {!uploading && (
            <span role={missing ? 'alert' : undefined} className={`text-[12px] ${missing ? '' : 'text-ink-3'}`}>
              {missing ? 'Take a photo first' : 'Required'}
            </span>
          )}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label="Photo at the door"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </>
  );
}
