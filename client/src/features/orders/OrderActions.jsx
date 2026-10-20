import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { api } from '../../lib/api.js';
import {
  RIDER_NEXT,
  RIDER_NEXT_LABEL as RIDER_LABEL,
  SHOP_NEXT as NEXT,
  SHOP_NEXT_LABEL as NEXT_LABEL,
  STATUS_LABELS,
} from '../../lib/constants.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { MarkDelivered } from '../rider/MarkDelivered.jsx';
import { retryLater, shortDay } from '../rider/delivery.js';


// The buttons that move an order along: the shop's next step, the rider's next step, and cancelling.
// Each role only gets the ones it's allowed; the server checks again.
export function OrderActions({ order, isSellerOfOrder, isRiderOfOrder, canCancel }) {
  const id = order._id;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const onDone = (message) => (res) => {
    // Status changes come back without the customer and shop filled in; keep the ones already loaded.
    queryClient.setQueryData(['order', id], (old) => ({
      ...res.order,
      user: old?.user,
      seller: old?.seller,
      reviewedProducts: old?.reviewedProducts,
    }));
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    toast.show(message);
  };
  const cancel = useMutation({
    mutationFn: () => api(`/orders/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: (res) => {
      setConfirmCancel(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onDone('Order cancelled')(res);
    },
    onError: (err) => toast.error(err.message),
  });
  const deliver = useMutation({
    mutationFn: (status) => api(`/deliveries/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      onDone(`Order marked as ${STATUS_LABELS[res.order.status].toLowerCase()}`)(res);
    },
    onError: (err) => toast.error(err.message),
  });
  const advance = useMutation({
    mutationFn: (status) => api(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: (res) => onDone(`Order marked as ${STATUS_LABELS[res.order.status].toLowerCase()}`)(res),
    onError: (err) => toast.error(err.message),
  });

  const next = isSellerOfOrder ? NEXT[order.status] : undefined;
  const riderNext = isRiderOfOrder ? RIDER_NEXT[order.status] : undefined;

  return (
    <div className="flex flex-wrap gap-2">
      {next && (
        <Button onClick={() => advance.mutate(next)} loading={advance.isPending}>
          {NEXT_LABEL[next]}
        </Button>
      )}
      {riderNext === 'delivered' && <MarkDelivered order={order} />}
      {riderNext && riderNext !== 'delivered' && (
        // Same rule as the run sheet: a buyer who asked for a later day can't be set off before it. (Missed and
        // Decline stay on the run sheet, the rider's one place for handling a run.)
        <Button
          onClick={() => deliver.mutate(riderNext)}
          loading={deliver.isPending}
          disabled={retryLater(order)}
        >
          {retryLater(order)
            ? `Start delivery on ${shortDay.format(new Date(order.retryOn))}`
            : RIDER_LABEL[riderNext]}
        </Button>
      )}
      {canCancel && (
        <Button variant="danger" onClick={() => setConfirmCancel(true)}>
          Cancel order
        </Button>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        confirmLabel="Cancel order"
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onClose={() => setConfirmCancel(false)}
      >
        The items go back into stock. This can&apos;t be undone.
      </ConfirmDialog>
    </div>
  );
}
