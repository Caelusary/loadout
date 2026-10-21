import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { RatingInput } from '../../components/ui/controls.jsx';
import { SelectField, TextAreaField } from '../../components/ui/fields.jsx';
import { api } from '../../lib/api.js';
import { RIDER_REPORT_LABELS, VEHICLE_LABELS } from '../../lib/constants.js';
import { useToast } from '../../providers/ToastProvider.jsx';

const ON_THE_WAY = ['shipped', 'out-for-delivery'];

function useFeedback(order, path, onDone) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api(`/orders/${order._id}/${path}`, { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', order._id] });
      onDone?.();
    },
    onError: (err) => toast.error(err.fields ? Object.values(err.fields)[0] : err.message),
  });
}

// Stars for the rider, offered once the buyer has said the order arrived (in the order page's "How did it go?" box).
export function RateRider({ order }) {
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const rate = useFeedback(order, 'rider-rating', () => toast.show('Thanks for rating your rider'));
  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!stars) return toast.error('Pick 1 to 5 stars.');
        rate.mutate({ stars, comment });
      }}
    >
      <RatingInput value={stars} onChange={setStars} />
      <TextAreaField
        label="Comment"
        optional
        rows={2}
        maxLength={300}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button type="submit" size="sm" variant="secondary" className="self-start" loading={rate.isPending}>
        Rate rider
      </Button>
    </form>
  );
}

// A report about the rider's behaviour. Sending one pauses the rider from new deliveries until an admin looks.
function ReportRider({ order }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const close = () => {
    setOpen(false);
    setReason('');
    setNote('');
  };
  const report = useFeedback(order, 'rider-report', () => {
    toast.show('Thanks for telling us. The rider is paused while an admin looks into it.');
    close();
  });
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[13px] text-ink-3 underline underline-offset-2 hover:text-bad"
      >
        Report a problem with the rider
      </button>
      <ConfirmDialog
        open={open}
        title="Report the rider"
        confirmLabel="Send report"
        cancelLabel="Back"
        pending={report.isPending}
        onConfirm={() => {
          if (!reason) return toast.error('Pick what happened.');
          if (note.trim().length < 3) return toast.error('Tell us what happened.');
          report.mutate({ reason, note });
        }}
        onClose={close}
      >
        <p>
          An admin reads every report. Until they do, the rider gets no new deliveries. The rider never sees
          your name.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <SelectField
            label="What happened"
            placeholder="Choose one"
            options={Object.entries(RIDER_REPORT_LABELS).map(([value, label]) => ({ value, label }))}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <TextAreaField
            label="Details"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}

// The order page's rider block. Buyers see a first name, plus the vehicle and plate while it's on the way, and can
// see their rating of the rider (given in the box at the top of the order page) or report them while it's on the way and up to 7 days after delivery.
export function RiderCard({ order, isCustomer, isAdmin }) {
  const rider = order.rider;
  if (!rider) return null;
  const p = rider.riderProfile ?? {};
  const onTheWay = ON_THE_WAY.includes(order.status);
  // The server works out what the buyer can still do (it knows the return window).
  const feedback = isCustomer ? order.riderFeedback : null;

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[13px] font-medium text-ink-3">Rider</h2>
      <p>
        {isAdmin ? (
          <Link to={`/admin/riders/${rider._id}`} data-cursor-skip>
            {rider.name}
          </Link>
        ) : (
          rider.name
        )}
      </p>
      {onTheWay && (p.vehicle || p.plate) && (
        <p className="text-ink-2">
          {p.vehicle && VEHICLE_LABELS[p.vehicle]}
          {p.plate && <span className="ml-2 font-mono">{p.plate}</span>}
        </p>
      )}
      {order.deliveredBy === 'rider' && <p className="text-ink-2">Delivered by the rider</p>}
      {isCustomer && feedback?.stars && (
        <p className="text-ink-2">
          You rated them {feedback.stars} star{feedback.stars === 1 ? '' : 's'}
        </p>
      )}
      {isCustomer && feedback?.reported && (
        <p className="text-ink-2">You reported this rider. An admin is looking into it.</p>
      )}
      {feedback?.canReport && <ReportRider order={order} />}
    </div>
  );
}
