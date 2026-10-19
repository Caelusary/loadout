import { useQueryClient } from '@tanstack/react-query';
import { X } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { ReviewForm } from './ReviewForm.jsx';

// "Review" beside an item on a delivered order, so reviewing is one tap from the order instead of a hunt for the product
// page. The form is the one used under the product, photos included. Held back while a "not received" report is open.
export function RateItem({ order, item, autoOpen = false, onAutoOpen }) {
  const dialog = useRef(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!autoOpen || !dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    onAutoOpen?.();
  }, [autoOpen, onAutoOpen]);
  if (order.status !== 'delivered') return null;
  if (order.reviewedProducts?.includes(item.product)) return <Tag tone="ok">Reviewed</Tag>;
  if (order.deliveryIssue?.status === 'open') return null;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => dialog.current.showModal()}
        aria-label={`Review ${item.name}`}
      >
        Review
      </Button>
      <dialog
        ref={dialog}
        aria-label={`Review ${item.name}`}
        className="m-auto max-h-[92dvh] w-[min(34rem,calc(100vw-2rem))] rounded-panel border border-seam bg-plate p-0 text-ink backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between gap-3 border-b border-seam px-5 py-3">
          <h2 className="wide truncate text-lg font-bold">Review {item.name}</h2>
          <button
            type="button"
            onClick={() => dialog.current.close()}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-raised hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">
          <ReviewForm
            className=""
            submitLabel="Post review"
            onCancel={() => dialog.current.close()}
            onSubmit={async (values) => {
              await api(`/products/${item.product}/reviews`, { method: 'POST', body: values });
              dialog.current.close();
              toast.show('Thanks, your review is up');
              queryClient.invalidateQueries({ queryKey: ['order', order._id] });
              queryClient.invalidateQueries({ queryKey: ['reviews', item.product] });
              queryClient.invalidateQueries({ queryKey: ['product'] });
            }}
          />
        </div>
      </dialog>
    </>
  );
}
