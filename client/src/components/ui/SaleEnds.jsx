import { useEffect, useState } from 'react';
import { formatDate } from '../../lib/format.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "Ends in 2d 4h" for a sale that ends within a week; further out it's just the date. Ticks once a minute, which is
// as fine as it reads, so a page full of tiles costs nothing noticeable. Hidden once the sale is over (the server
// puts the price back within the minute).
export function SaleEnds({ endsAt, className = '' }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = new Date(endsAt).getTime() - now;
  if (left <= 0) return null;
  const days = Math.floor(left / DAY);
  const hours = Math.floor((left % DAY) / HOUR);
  const minutes = Math.max(1, Math.floor((left % HOUR) / MINUTE));
  const text =
    left > 7 * DAY
      ? `Sale ends ${formatDate(endsAt)}`
      : days > 0
        ? `Ends in ${days}d ${hours}h`
        : hours > 0
          ? `Ends in ${hours}h ${minutes}m`
          : `Ends in ${minutes}m`;
  return (
    <span className={className} title={`Sale ends ${formatDate(endsAt)}`}>
      {text}
    </span>
  );
}
