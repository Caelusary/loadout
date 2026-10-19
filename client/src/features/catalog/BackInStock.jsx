import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellSlash } from '@phosphor-icons/react';
import { Link, useLocation } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

// On a sold-out product: "Notify me when it's back". The bell gets a notice once the shop restocks, then the request
// is cleared. Guests are sent to sign in; admins and riders don't shop, so they don't see it.
export function BackInStock({ product }) {
  const { user, canShop } = useAuth();
  const { pathname } = useLocation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ['stock-alert', product._id];
  const { data } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api(`/products/${product._id}/stock-alert`, { signal }),
    enabled: Boolean(user && canShop),
  });
  const toggle = useMutation({
    mutationFn: (on) => api(`/products/${product._id}/stock-alert`, { method: on ? 'PUT' : 'DELETE' }),
    onSuccess: (res) => {
      queryClient.setQueryData(key, res);
      toast.show(res.subscribed ? "We'll let you know when it's back" : "Okay, we won't tell you");
    },
    onError: (err) => toast.error(err.fields?.product ?? err.message),
  });

  if (!user) {
    return (
      <p className="text-[13px] text-ink-2">
        <Link to={`/login?next=${encodeURIComponent(pathname)}`} className="text-accent-ink underline underline-offset-2">
          Sign in
        </Link>{' '}
        to be told when it&apos;s back.
      </p>
    );
  }
  if (!canShop) return null;
  const on = Boolean(data?.subscribed);
  return (
    <Button variant={on ? 'ghost' : 'secondary'} className="self-start" loading={toggle.isPending} onClick={() => toggle.mutate(!on)}>
      {on ? <BellSlash size={18} aria-hidden="true" /> : <Bell size={18} aria-hidden="true" />}
      {on ? "Stop telling me" : "Notify me when it's back"}
    </Button>
  );
}
