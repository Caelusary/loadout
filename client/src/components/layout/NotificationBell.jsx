import { Bell } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

const KEY = ['notifications'];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => api('/notifications', { signal }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const unread = data?.unread ?? 0;

  const markLocally = (id) =>
    queryClient.setQueryData(KEY, (old) => {
      if (!old) return old;
      const now = new Date().toISOString();
      const items = old.items.map((n) => (!n.readAt && (!id || n._id === id) ? { ...n, readAt: now } : n));
      return { items, unread: items.filter((n) => !n.readAt).length };
    });
  const markRead = useMutation({
    mutationFn: (id) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onMutate: markLocally,
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
  const markAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'PATCH' }),
    onMutate: () => markLocally(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative grid size-10 place-items-center rounded-control text-ink-2 transition-colors hover:bg-raised hover:text-ink"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-neon px-1 font-mono text-[11px] font-medium text-white tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        // On phones the bell isn't the last icon, so the panel spans the screen under the top bar instead of hanging off the bell.
        <div className="absolute top-12 right-0 z-40 flex max-h-[min(28rem,70dvh)] w-[min(22rem,calc(100vw-2rem))] max-sm:fixed max-sm:inset-x-3 max-sm:top-[calc(4rem+0.5rem+env(safe-area-inset-top))] max-sm:w-auto origin-top-right max-sm:origin-top flex-col overflow-hidden rounded-panel border border-seam bg-plate shadow-[0_12px_32px_-16px_rgb(0_0_0/0.7)] transition-[opacity,scale] duration-150 ease-out starting:scale-95 starting:opacity-0">
          <div className="flex items-center justify-between border-b border-seam px-4 py-3">
            <h2 className="text-sm font-medium">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={() => markAll.mutate()} className="text-[13px] text-accent-ink hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {!data?.items.length ? (
            <p className="px-4 py-8 text-center text-sm text-ink-3">You&apos;re all caught up. Order updates will show up here.</p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-seam overflow-y-auto">
              {data.items.map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.readAt) markRead.mutate(n._id);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                    className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-raised"
                  >
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-accent'}`} aria-hidden="true" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={`text-[14px] ${n.readAt ? 'text-ink-2' : 'font-medium text-ink'}`}>
                        {!n.readAt && <span className="sr-only">Unread: </span>}
                        {n.title}
                      </span>
                      {n.body && <span className="line-clamp-2 text-[13px] text-ink-3">{n.body}</span>}
                      <span className="font-mono text-[11px] text-ink-3">{formatDateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
