import { CaretDown, CaretUp, ChatCircleText, PencilSimple, SealCheck, X } from '@phosphor-icons/react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { RatingDisplay } from '../../components/ui/controls.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { SortMenu } from '../catalog/SortMenu.jsx';
import { useMediaQuery } from '../home/capabilities.js';
import { ReviewCard } from './ReviewCard.jsx';
import { ReviewForm } from './ReviewForm.jsx';
import { ReviewFilters, ReviewSummary } from './ReviewSummary.jsx';

const SORTS = [
  ['newest', 'Newest'],
  ['helpful', 'Most helpful'],
  ['highest', 'Highest rated'],
  ['lowest', 'Lowest rated'],
];
// The round chevron that opens and closes the list; its label says what it does, for screen readers and on hover.
const chevron =
  'grid size-11 place-items-center rounded-full border border-accent-ink/70 bg-bg/85 text-accent-ink backdrop-blur-sm transition-colors hover:bg-accent/10';

// A product's reviews, closed by default: the summary beside one featured review that fades out under a chevron.
// Opening it lets the list grow into the page, loading more as you near the end. The page stays the only thing that
// scrolls (a scroll box inside it keeps hold of the wheel mid-gesture), so instead the header and the summary card pin
// while the section is on screen. On a phone it opens a sheet over the page instead.
export function ReviewSection({ product }) {
  const { user, isAdmin, can, canShop } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const phone = useMediaQuery('(max-width: 639px)');
  // Arriving on a link to one review (#review-<id>) opens the reviews straight away.
  const [open, setOpen] = useState(() => location.hash.startsWith('#review-'));
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [writing, setWriting] = useState(false);
  const [photosOnly, setPhotosOnly] = useState(false);
  const [stars, setStars] = useState(null);
  const [sort, setSort] = useState('newest');
  const sheet = useRef(null);
  // The closed height follows the summary card. The header's height sets where the summary card pins, just below it.
  const section = useRef(null);
  const summaryBox = useRef(null);
  const header = useRef(null);
  const [summaryHeight, setSummaryHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(64);
  useEffect(() => {
    const height = (el) => (entry) => entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight;
    const watch = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === summaryBox.current) setSummaryHeight(height(summaryBox.current)(entry));
        if (entry.target === header.current) setHeaderHeight(height(header.current)(entry));
      }
    });
    if (summaryBox.current) watch.observe(summaryBox.current);
    if (header.current) watch.observe(header.current);
    return () => watch.disconnect();
  }, []);
  const isShop = Boolean(user) && product.seller?._id === user._id;
  const shopName = product.seller?.sellerProfile?.shopName ?? 'the shop';

  const query = useInfiniteQuery({
    queryKey: ['reviews', product._id, user?._id ?? 'guest', photosOnly, stars, sort],
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ page: String(pageParam), sort });
      if (photosOnly) params.set('photos', '1');
      if (stars) params.set('stars', String(stars));
      return api(`/products/${product._id}/reviews?${params}`, { signal });
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    placeholderData: (previous) => previous, // keep the list on screen while a filter loads
  });
  const first = query.data?.pages[0];
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = photosOnly || stars != null;
  const total = product.ratingCount;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reviews', product._id] });
    queryClient.invalidateQueries({ queryKey: ['product', product.slug] });
  };
  const filterBy = (next) => {
    setStars(next.stars ?? null);
    setPhotosOnly(next.photos ?? false);
  };
  const show = () => {
    setOpen(true);
    if (phone) sheet.current?.showModal();
  };
  const hide = () => {
    setOpen(false);
    sheet.current?.close();
    // Collapsing from further down the list would leave you below the section, among unrelated content.
    const box = section.current;
    if (!phone && box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // A link to one review (#review-<id>, from the shop's inbox or a reply notice) opens the reviews, scrolls to it and
  // makes it glow for a moment. If it isn't loaded, it lands on the section instead.
  const jumped = useRef('');
  const target = location.hash.slice(1);
  useEffect(() => {
    if (!first || !target.startsWith('review-') || jumped.current === target) return;
    jumped.current = target;
    if (phone && !sheet.current?.open) sheet.current?.showModal();
    requestAnimationFrame(() => {
      const el = document.getElementById(target) ?? document.getElementById('reviews');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el?.id !== target) return;
      el.dataset.flash = '';
      setTimeout(() => delete el.dataset.flash, 2200); // not cleared on refetch, so the glow always ends
    });
  }, [first, target, phone]);

  const remove = useMutation({
    mutationFn: (id) => api(`/reviews/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleting(null);
      toast.show('Review deleted');
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  // Signed out, there's nothing to offer here: only buyers review, and the header already has Sign in.
  const cta = !user ? null : first?.canReview ? (
    <Button className="w-full" onClick={() => setWriting(true)}>
      <PencilSimple size={16} /> Write a review
    </Button>
  ) : first?.myReviewId ? (
    <p className="flex items-center gap-2 text-sm text-ink-2">
      <SealCheck size={16} weight="fill" className="text-ok" /> You've reviewed this product.
    </p>
  ) : first && !isAdmin && !isShop ? (
    <p className="text-[13px] text-ink-3">Reviews come from buyers whose order was delivered.</p>
  ) : null;

  const card = (r, anchor = true) => {
    const mine = user && r.user?._id === user._id;
    // Why this viewer can't vote, if they can't (the server checks the same).
    const voteBlocked = !user
      ? 'Sign in to vote on reviews.'
      : !canShop
        ? 'Only shoppers can vote on reviews.'
        : mine
          ? "You can't vote on your own review."
          : isShop
            ? "Shops can't vote on reviews of their own products."
            : null;
    if (editing === r._id) {
      return (
        <div key={r._id} className="rounded-panel border border-accent-ink/40 bg-plate p-5">
          <ReviewForm
            initial={{ rating: r.rating, title: r.title, body: r.body, images: r.images }}
            submitLabel="Save review"
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              await api(`/reviews/${r._id}`, { method: 'PATCH', body: values });
              setEditing(null);
              toast.show('Review updated');
              refresh();
            }}
          />
        </div>
      );
    }
    return (
      <ReviewCard
        key={r._id}
        review={r}
        anchor={anchor}
        shopName={shopName}
        isShop={isShop}
        canModerate={can('products')}
        onEdit={mine ? () => setEditing(r._id) : undefined}
        // Admins with the Products area can remove any review; it's logged and the owner can restore it.
        onDelete={mine || can('products') ? () => setDeleting(r) : undefined}
        onReplyChange={refresh}
        voteBlocked={voteBlocked}
      />
    );
  };

  const empty = (
    <div className="flex flex-col items-center gap-2 rounded-panel border border-dashed border-seam px-6 py-12 text-center">
      <ChatCircleText size={28} className="text-ink-3" />
      <p className="font-medium text-ink">{filtered ? 'No reviews match' : 'No reviews yet'}</p>
      <p className="text-sm text-ink-3">
        {filtered ? (
          <button
            type="button"
            onClick={() => filterBy({})}
            className="text-accent-ink underline underline-offset-2"
          >
            Show all reviews
          </button>
        ) : first?.canReview ? (
          'Be the first to say how it holds up.'
        ) : (
          'Buyers can review it once their order is delivered.'
        )}
      </p>
    </div>
  );

  // The scrolling list used by both the open panel and the phone sheet.
  const list = (
    <ReviewList
      query={query}
      items={items}
      empty={empty}
      card={card}
      dim={query.isPlaceholderData}
      mode="sheet"
    />
  );
  const sortMenu = <SortMenu sorts={SORTS} value={sort} onChange={setSort} />;
  const writeForm = writing && first?.canReview && (
    <div className="rounded-panel border border-accent-ink/40 bg-plate p-5">
      <ReviewForm
        submitLabel="Post review"
        onCancel={() => setWriting(false)}
        onSubmit={async (values) => {
          await api(`/products/${product._id}/reviews`, { method: 'POST', body: values });
          setWriting(false);
          toast.show('Thanks, your review is up');
          refresh();
        }}
      />
    </div>
  );
  const summary = (
    <ReviewSummary
      product={product}
      breakdown={first?.breakdown}
      stars={stars}
      onStars={(n) => {
        filterBy({ stars: n, photos: photosOnly });
        if (!open) show();
      }}
    >
      {cta}
    </ReviewSummary>
  );
  const desktopOpen = open && !phone;
  // Closed, the reviews column is as tall as the summary card beside it (taller on a phone, where it sits below),
  // clipped with a fade; open, it grows to fit every loaded review. One box animating its height, so nothing jumps.
  // Counts what the filters leave, so a single photo review doesn't offer to show more.
  const shown = first?.total ?? total;
  const clipped = shown > 1;
  const height = !clipped || desktopOpen ? 'auto' : phone ? 440 : Math.max(summaryHeight, 300);

  return (
    <section ref={section} id="reviews" className="mt-20 scroll-mt-16 border-t border-seam pt-7">
      {/* The header carries the count, the filters in use and Sort, so the summary card and the first review start
          level beside each other. Open, it pins under the navbar (65px) until the section scrolls away. Its padding is the same either way, so pinning moves nothing. */}
      <div
        ref={header}
        className={`z-20 -mx-4 mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-4 py-3 transition-colors duration-300 sm:-mx-6 sm:px-6 ${
          desktopOpen ? 'sticky top-[65px] border-seam bg-bg/85 backdrop-blur-md' : 'border-transparent'
        }`}
      >
        <h2 className="wide text-2xl font-bold">Reviews</h2>
        {total > 0 && (
          <>
            <p className="font-mono text-[13px] text-ink-2 tabular-nums">
              {first?.total ?? total} review{(first?.total ?? total) === 1 ? '' : 's'}
            </p>
            {stars != null && (
              <button
                type="button"
                onClick={() => filterBy({ photos: photosOnly })}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent/15 px-3 text-[12px] font-medium text-accent-ink hover:bg-accent/25"
              >
                only {stars}★ <X size={11} weight="bold" aria-label="Show every rating" />
              </button>
            )}
            {first?.photoCount > 0 && (
              <ReviewFilters
                breakdown={first?.breakdown}
                photoCount={first?.photoCount}
                stars={stars}
                photosOnly={photosOnly}
                onChange={filterBy}
              />
            )}
            <div className="ml-auto max-sm:hidden">{sortMenu}</div>
          </>
        )}
      </div>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (
        <div className="grid gap-6 md:grid-cols-[288px_minmax(0,1fr)] md:gap-8">
          <div ref={summaryBox} className="self-start md:sticky" style={{ top: 65 + headerHeight + 16 }}>
            {summary}
          </div>
          <div className="flex min-w-0 flex-col">
            {writeForm && <div className="mb-3">{writeForm}</div>}
            <div
              className="relative flex flex-col overflow-hidden transition-[height] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] [interpolate-size:allow-keywords] motion-reduce:transition-none"
              style={{ height }}
              data-reviews-box
            >
              <ReviewList
                query={query}
                items={items}
                empty={empty}
                card={(r) => card(r, !phone)}
                dim={query.isPlaceholderData}
                mode={desktopOpen || !clipped ? 'flow' : 'clip'}
              />
              {clipped && (
                <div
                  className={`absolute inset-x-0 bottom-0 flex h-40 items-end justify-center bg-gradient-to-b from-transparent via-bg/85 to-bg pb-3 transition-opacity duration-300 ${
                    desktopOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={show}
                    tabIndex={desktopOpen ? -1 : 0}
                    aria-label={`Show all ${shown} reviews`}
                    title={`Show all ${shown} reviews`}
                    className={chevron}
                  >
                    <CaretDown size={18} weight="bold" />
                  </button>
                </div>
              )}
            </div>
            {/* Open, the collapse chevron floats at the bottom of the screen, where the open one was, for as long as
                the list is in view, and settles at the list's end when you get there. */}
            {desktopOpen && clipped && (
              <div className="pointer-events-none sticky bottom-6 z-10 mt-4 flex justify-center transition-opacity duration-300 starting:opacity-0">
                <button
                  type="button"
                  onClick={hide}
                  aria-label="Show fewer reviews"
                  title="Show fewer reviews"
                  className={`pointer-events-auto shadow-lg shadow-black/40 ${chevron}`}
                >
                  <CaretUp size={18} weight="bold" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phones: the full list in a sheet over the page, with its own scroll. */}
      <dialog
        ref={sheet}
        onClose={() => setOpen(false)}
        aria-label="Reviews"
        className="mt-auto mb-0 h-[88dvh] max-h-none w-full max-w-none flex-col rounded-t-panel border-t border-seam bg-bg p-0 text-ink open:flex sm:hidden"
      >
        <div
          tabIndex={-1}
          autoFocus
          className="flex shrink-0 outline-none flex-col gap-3 border-b border-seam px-4 pt-2.5 pb-3"
        >
          <span className="mx-auto h-1 w-10 rounded-full bg-edge" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl leading-none tabular-nums">
                {total ? product.ratingAvg.toFixed(1) : '–'}
              </span>
              <span className="flex flex-col">
                <RatingDisplay value={product.ratingAvg ?? 0} />
                <span className="text-[12px] text-ink-3">
                  {total} review{total === 1 ? '' : 's'}
                </span>
              </span>
            </div>
            <div className="mr-1 ml-auto">
              <SortMenu sorts={SORTS} value={sort} onChange={setSort} width="w-36" />
            </div>
            <button
              type="button"
              onClick={hide}
              aria-label="Close reviews"
              className="grid size-10 place-items-center rounded-control text-ink-2 hover:bg-raised"
            >
              <X size={20} />
            </button>
          </div>
          <ReviewFilters
            breakdown={first?.breakdown}
            photoCount={first?.photoCount}
            stars={stars}
            photosOnly={photosOnly}
            onChange={filterBy}
            withStars
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3">
          {writeForm}
          {phone && open && list}
        </div>
      </dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this review?"
        confirmLabel="Delete review"
        pending={remove.isPending}
        onConfirm={() => remove.mutate(deleting._id)}
        onClose={() => setDeleting(null)}
      >
        {deleting && user && deleting.user?._id !== user._id
          ? `This removes ${deleting.user?.name ?? 'this buyer'}'s review and updates the product rating.`
          : 'Your review will be removed and the product rating updated.'}
      </ConfirmDialog>
    </section>
  );
}

// The list of reviews, loading the next page as its end comes into view. Three ways to show it:
// - clip: the closed section, held still and cut off under the fade; loads nothing more.
// - flow: open on desktop, as tall as its reviews and scrolled with the page.
// - sheet: the phone sheet, its own scroll area (no visible bar, a fade at the bottom while there's more).
function ReviewList({ query, items, empty, card, dim, mode = 'flow' }) {
  const scrollable = mode !== 'clip';
  const sheet = mode === 'sheet';
  const box = useRef(null);
  const end = useRef(null);
  const [more, setMore] = useState(false);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    const root = box.current;
    if (!root || !end.current || !scrollable) return;
    const seen = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && hasNextPage && !isFetchingNextPage && fetchNextPage(),
      { root: sheet ? root : null, rootMargin: '400px' },
    );
    seen.observe(end.current);
    return () => seen.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length, scrollable, sheet]);



  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const check = () => setMore(root.scrollTop + root.clientHeight < root.scrollHeight - 4);
    check();
    root.addEventListener('scroll', check, { passive: true });
    return () => root.removeEventListener('scroll', check);
  }, [items.length]);

  return (
    <div
      ref={box}
      className={`min-h-0 flex-1 ${sheet ? `no-scrollbar overflow-y-auto overscroll-contain pb-4 ${more ? 'fade-bottom' : ''}` : ''}`}
    >
      {query.isPending ? (
        <Skeleton className="h-48 rounded-panel" />
      ) : items.length === 0 ? (
        empty
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity ${dim ? 'opacity-60' : ''}`}>
          {items.map((r) => card(r))}
          <div ref={end} aria-hidden="true" />
          {isFetchingNextPage && <Skeleton className="h-32 rounded-panel" />}
          {!hasNextPage && items.length > 3 && (
            <p className="py-2 text-center text-[12px] text-ink-3">That's every review.</p>
          )}
        </div>
      )}
    </div>
  );
}
