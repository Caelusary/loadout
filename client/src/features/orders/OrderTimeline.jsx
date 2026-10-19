import { STATUS_LABELS } from '../../lib/constants.js';
import { formatDateTime } from '../../lib/format.js';

const STEPS = ['placed', 'processing', 'shipped', 'out-for-delivery', 'delivered'];

// A step tracker built from the order's status history. Each reached step shows when it happened;
// a cancelled order shows the steps it got through and where it stopped.

export function OrderTimeline({ order }) {
  const history = order.statusHistory?.length
    ? order.statusHistory
    : [{ status: 'placed', at: order.createdAt }];
  // 'placed' always comes from createdAt: orders saved before status history existed get a schema default
  // stamped with the time they were loaded, which would be wrong.
  const when = { ...Object.fromEntries(history.map((e) => [e.status, e.at])), placed: order.createdAt };
  const cancelled = order.status === 'cancelled';
  const reached = STEPS.filter((s) => when[s]);
  const steps = cancelled ? [...reached, 'cancelled'] : STEPS;
  const current = cancelled ? steps.length - 1 : STEPS.indexOf(order.status);

  return (
    <ol className="grid gap-y-4 sm:grid-flow-col sm:auto-cols-fr" aria-label="Order timeline">
      {steps.map((step, i) => {
        const done = i <= current;
        const stop = step === 'cancelled';
        return (
          <li
            key={step}
            className="relative flex gap-3 sm:flex-col sm:gap-2"
            aria-current={i === current ? 'step' : undefined}
          >
            <div className="flex flex-col items-center sm:flex-row">
              <span
                className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                  stop ? 'border-bad bg-bad' : done ? 'border-accent bg-accent' : 'border-seam bg-bg'
                }`}
              >
                {done && <span className={`size-2 rounded-full ${stop ? 'bg-bg' : 'bg-on-accent'}`} />}
              </span>
              {i < steps.length - 1 && (
                <span
                  className={`h-full min-h-6 w-0.5 sm:h-0.5 sm:min-h-0 sm:w-full ${i < current ? 'bg-accent' : 'bg-seam'}`}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="flex flex-col pb-1">
              <span
                className={`text-[14px] font-medium ${stop ? 'text-bad' : done ? 'text-ink' : 'text-ink-3'}`}
              >
                {STATUS_LABELS[step]}
              </span>
              {/* Orders from before riders went straight from shipped to delivered. */}
              <span className="font-mono text-[12px] text-ink-3 tabular-nums">
                {when[step] ? formatDateTime(when[step]) : done ? '—' : 'Not yet'}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
