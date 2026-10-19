import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { ChoiceChips, TextAreaField } from '../../components/ui/fields.jsx';
import { api } from '../../lib/api.js';
import { DECLINE_REASON_LABELS } from '../../lib/constants.js';
import { orderNumber } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';

// "Can't take it": only before pickup. The order goes straight to the next rider and never comes back to this one.
export function DeclineDelivery({ order }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const close = () => {
    setOpen(false);
    setReason('');
    setNote('');
    setErrors({});
  };
  const decline = useMutation({
    mutationFn: () => api(`/deliveries/${order._id}/decline`, { method: 'POST', body: { reason, note } }),
    onSuccess: () => {
      toast.show(`${orderNumber(order._id)} went to another rider`);
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      close();
    },
    onError: (err) => (err.fields ? setErrors(err.fields) : toast.error(err.message)),
  });
  const submit = () => {
    if (!reason) return setErrors({ reason: 'Pick a reason.' });
    if (reason === 'other' && note.trim().length < 3)
      return setErrors({ note: 'Tell us why in a few words.' });
    decline.mutate();
  };

  return (
    <>
      <Button variant="ghost" className="self-start max-sm:w-full" onClick={() => setOpen(true)}>
        Can&apos;t take it
      </Button>
      <ConfirmDialog
        open={open}
        title={`Turn down ${orderNumber(order._id)}?`}
        confirmLabel="Turn it down"
        cancelLabel="Keep it"
        tone="danger"
        pending={decline.isPending}
        onConfirm={submit}
        onClose={close}
      >
        <p>It goes to the next free rider straight away. Admins see the reason you give.</p>
        <div className="mt-4 flex flex-col gap-4">
          <ChoiceChips
            legend="Reason"
            name={`decline-${order._id}`}
            options={Object.entries(DECLINE_REASON_LABELS).map(([value, label]) => ({ value, label }))}
            value={reason}
            error={errors.reason}
            onChange={setReason}
          />
          <TextAreaField
            label="Anything to add"
            optional={reason !== 'other'}
            rows={2}
            maxLength={200}
            value={note}
            error={errors.note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
