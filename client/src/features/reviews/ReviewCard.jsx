import { PencilSimple, SealCheck, Trash } from '@phosphor-icons/react';
import { Tag } from '../../components/ui/chips.jsx';
import { RatingDisplay } from '../../components/ui/controls.jsx';
import { formatDate, initials } from '../../lib/format.js';
import { PhotoStrip } from './PhotoStrip.jsx';
import { ReviewVotes } from './ReviewVotes.jsx';
import { ShopReply } from './ShopReply.jsx';

// One review: who wrote it (every review needs a delivered order, so "Verified buyer" is always true), the stars,
// what they said, their photos, and the shop's reply inset below. `onEdit` / `onDelete` show only when allowed.
// `anchor` gives it the #review-<id> target that links jump to; the closed section's featured copy goes without, so
// the id stays unique on the page.
export function ReviewCard({
  review: r,
  shopName,
  isShop,
  canModerate,
  onEdit,
  onDelete,
  onReplyChange,
  voteBlocked,
  anchor = true,
  className = '',
}) {
  const name = r.user?.name ?? 'Deleted account';
  return (
    <article
      id={anchor ? `review-${r._id}` : undefined}
      className={`flex scroll-mt-24 flex-col gap-3 rounded-panel border border-seam bg-plate p-5 transition-shadow duration-700 data-flash:shadow-[0_0_0_2px_var(--color-accent-ink),0_0_24px_-4px_var(--color-accent)] ${className}`}
    >
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-[12px] font-medium text-accent-ink">
          {r.user ? initials(name) : '?'}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-ink">{name}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-3">
            <span className="inline-flex items-center gap-1 text-ok">
              <SealCheck size={13} weight="fill" /> Verified buyer
            </span>
            · {formatDate(r.createdAt)}
          </span>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex shrink-0 gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label="Edit your review"
                title="Edit"
                className="grid size-8 place-items-center rounded-control text-ink-3 hover:bg-raised hover:text-ink"
              >
                <PencilSimple size={16} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={onEdit ? 'Delete your review' : `Delete ${name}'s review`}
                title="Delete"
                className="grid size-8 place-items-center rounded-control text-ink-3 hover:bg-raised hover:text-bad"
              >
                <Trash size={16} />
              </button>
            )}
          </div>
        )}
      </header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <RatingDisplay value={r.rating} />
        <h3 className="font-medium text-ink">{r.title}</h3>
        {r.returned && <Tag>Returned for a refund</Tag>}
      </div>
      <p className="max-w-[65ch] text-[15px] leading-relaxed text-ink-2">{r.body}</p>
      <PhotoStrip photos={r.images} owner={name} />
      <ReviewVotes review={r} blocked={voteBlocked} />
      <ShopReply
        review={r}
        shopName={shopName}
        isShop={isShop}
        canModerate={canModerate}
        onChange={onReplyChange}
      />
    </article>
  );
}
