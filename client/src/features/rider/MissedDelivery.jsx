import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { ChoiceChips, TextAreaField } from '../../components/ui/fields.jsx';
import { api } from '../../lib/api.js';
import { ATTEMPT_REASON_LABELS, MAX_ATTEMPTS } from '../../lib/constants.js';
import { orderNumber } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { ProofPhoto } from './ProofPhoto.jsx';

// "Couldn't deliver": the rider is at the door and can't hand it over. A photo backs it up, the same as delivering.
// The first miss puts it back in the list for another try; the last one sends it back to the shop.
export function MissedDelivery({ order }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const tries = (order.attempts?.length ?? 0) + 1;
  const last = tries >= MAX_ATTEMPTS;

  const close = () => {
    setOpen(false);
    setReason('');
    setNote('');
    setPhoto(null);
    setErrors({});
  };
  const miss = useMutation({
    mutationFn: () =>
      api(`/deliveries/${order._id}/missed`, { method: 'POST', body: { reason, note, proof: { url: photo } } }),
    onSuccess: ({ returned }) => {
      toast.show(
        returned
          ? `${orderNumber(order._id)} is going back to the shop`
          : `${orderNumber(order._id)} is back in your list for another try`,
      );
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['order', order._id] });
      close();
    },
    onError: (err) => (err.fields ? setErrors(err.fields) : toast.error(err.message)),
  });
  const submit = () => {
    const found = { ...(!reason && { reason: 'Pick what happened.' }), ...(!photo && { proof: true }) };
    if (Object.keys(found).length) return setErrors(found);
    miss.mutate();
  };

  return (
    <>
      <Button variant="ghost" className="max-sm:w-full" onClick={() => setOpen(true)}>
        Couldn&apos;t deliver
      </Button>
      <ConfirmDialog
        open={open}
        title={`Couldn't deliver ${orderNumber(order._id)}?`}
        confirmLabel={last ? 'Send it back' : 'Try again later'}
        cancelLabel="Not yet"
        tone={last ? 'danger' : 'primary'}
        pending={miss.isPending}
        onConfirm={submit}
        onClose={close}
      >
        <p>
          {last
            ? `This is try ${tries} of ${MAX_ATTEMPTS}. The order is cancelled and goes back to the shop.`
            : `Try ${tries} of ${MAX_ATTEMPTS}. It stays in your list for another try, and the buyer can pick a later day if they're away.`}
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <ChoiceChips
            legend="What happened"
            name={`missed-${order._id}`}
            options={Object.entries(ATTEMPT_REASON_LABELS).map(([value, label]) => ({ value, label }))}
            value={reason}
            error={errors.reason}
            onChange={setReason}
          />
          <ProofPhoto
            photo={photo}
            onPhoto={(url) => {
              setPhoto(url);
              setErrors((e) => ({ ...e, proof: undefined }));
            }}
            missing={Boolean(errors.proof)}
          />
          <TextAreaField
            label="Anything to add"
            optional
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
