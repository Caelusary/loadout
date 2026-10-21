import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

async function fetchMe() {
  try {
    return (await api('/auth/me')).user;
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}

// The last signed-in account, kept on this device so a returning visitor's pages draw straight away instead of
// waiting on /auth/me first (one round trip saved on every account page). It's only a stand-in: /auth/me still runs
// on every load and replaces it, or signs the visitor out if the session ended. Cleared on sign-out.
const SAVED = 'loadout_session_v1';
function readSaved() {
  try {
    const user = JSON.parse(localStorage.getItem(SAVED));
    return user?._id && user.role ? user : undefined;
  } catch {
    return undefined;
  }
}
function save(user) {
  try {
    if (user) localStorage.setItem(SAVED, JSON.stringify(user));
    else localStorage.removeItem(SAVED);
  } catch {
    // Not remembered: the next visit just waits for /auth/me, as before.
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [saved] = useState(readSaved);
  const me = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    staleTime: Infinity,
    retry: false,
    placeholderData: saved,
  });
  // Keep the saved copy in step with what the server says (a sign-in, a profile edit, an ended session).
  useEffect(() => {
    if (!me.isPlaceholderData && me.isSuccess) save(me.data);
  }, [me.data, me.isPlaceholderData, me.isSuccess]);
  // True after the visitor clicks Sign out, so guards send them home instead of to the login page.
  const [signedOut, setSignedOut] = useState(false);

  const startSession = useCallback(
    (user) => {
      // Drop anything cached for the previous visitor before showing the new session.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
      queryClient.setQueryData(['me'], user);
      setSignedOut(false);
      return user;
    },
    [queryClient],
  );

  const value = useMemo(() => {
    const user = me.data ?? null;
    let status = 'guest';
    if (me.isPending) status = 'loading';
    else if (me.isError) status = 'error';
    else if (user) status = 'authenticated';

    return {
      user,
      status,
      signedOut,
      // False while `user` is still the account remembered on this device, before /auth/me has answered.
      confirmed: !me.isPlaceholderData,
      isAdmin: user?.role === 'admin',
      isOwner: Boolean(user?.isOwner),
      // Which parts of the admin panel this admin may manage; the owner has them all.
      can: (area) => user?.role === 'admin' && (user.isOwner || (user.adminPermissions ?? []).includes(area)),
      isSeller: user?.role === 'seller' && user?.sellerProfile?.status === 'approved',
      isRider: user?.role === 'rider',
      // Admins and riders don't buy: no cart, wishlist or checkout. Signed-out visitors can browse and add.
      canShop: !['admin', 'rider'].includes(user?.role),
      login: async (credentials) =>
        startSession((await api('/auth/login', { method: 'POST', body: credentials })).user),
      register: async (details) =>
        startSession((await api('/auth/register', { method: 'POST', body: details })).user),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        // Update the session in place rather than clearing the cache: clear() drops the queries that
        // mounted components are still subscribed to, so the navbar and page kept showing the old
        // account until a reload. Hidden data goes; what's on screen refetches as a guest.
        setSignedOut(true);
        queryClient.setQueryData(['me'], null);
        const notMe = (q) => q.queryKey[0] !== 'me';
        queryClient.removeQueries({ predicate: notMe, type: 'inactive' });
        queryClient.invalidateQueries({ predicate: notMe });
      },
      setUser: (next) => queryClient.setQueryData(['me'], next),
      retry: () => me.refetch(),
    };
  }, [me, queryClient, startSession, signedOut]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export const useAuth = () => use(AuthContext);
