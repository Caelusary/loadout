import { formatDate, formatMoney } from '../../lib/format.js';
import { PhotoStrip } from '../reviews/PhotoStrip.jsx';

// The rider's photo from the doorstep. Admins also get where the rider was (the server only sends it to them).
export function DeliveryProof({ order }) {
  const proof = order.deliveryProof;
  if (!proof) return null;
  const at = proof.location;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[13px] font-medium text-ink-3">Delivery photo</h2>
      <PhotoStrip photos={[proof.url]} owner="the rider" />
      <p className="text-[13px] text-ink-3">Taken {formatDate(proof.at)}</p>
      {at && (
        <p className="text-[13px] text-ink-2">
          Rider&apos;s location:{' '}
          <a
            href={`https://www.google.com/maps?q=${at.lat},${at.lng}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent-ink underline underline-offset-2"
          >
            open in Maps
          </a>
          {at.accuracy != null && ` (within ${at.accuracy} m)`}. Only admins see this.
        </p>
      )}
    </div>
  );
}

// Where the buyer's money is, simulated like Shopee's Guarantee: Loadout holds it until the buyer says the order
// arrived (or 7 days pass), then releases it to the shop.
export function PaymentNote({ order, isCustomer }) {
  const p = order.payment;
  if (!p || p.state === 'none') return null;
  const amount = formatMoney(p.amountCents);
  const copy = {
    held: {
      delivery: isCustomer
        ? 'Loadout holds your payment until the order arrives and you confirm it.'
        : `${amount} is held until the buyer confirms it arrived.`,
      buyer: isCustomer
        ? `Loadout holds your payment until you confirm it arrived, or until ${formatDate(p.releaseAt)}.`
        : `${amount} is held until the buyer confirms, or until ${formatDate(p.releaseAt)}.`,
      report: isCustomer
        ? 'Your payment stays held while an admin looks into your report.'
        : `${amount} stays held while an admin looks into the buyer's report.`,
    }[p.until],
    released: isCustomer
      ? `Paid to the shop on ${formatDate(p.releasedAt)}.`
      : `${amount} released to the shop on ${formatDate(p.releasedAt)}.`,
    refunded: isCustomer
      ? 'An admin upheld your report, so this goes back to you.'
      : `An admin upheld the buyer's report, so ${amount} goes back to them.`,
  }[p.state];
  const label = { held: 'Held by Loadout', released: 'Released', refunded: 'Returned to the buyer' }[p.state];
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[13px] font-medium text-ink-3">Payment status</h2>
      <p className={p.state === 'released' ? 'text-ok' : p.state === 'refunded' ? 'text-bad' : 'text-ink'}>
        {label}
      </p>
      <p className="text-[13px] text-ink-2">{copy}</p>
      <p className="text-[12px] text-ink-3">Simulated: no real money moves.</p>
    </div>
  );
}
