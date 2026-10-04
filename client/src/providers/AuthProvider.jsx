import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, useCallback, useMemo } from 'react';
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

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: Infinity, retry: false });

  const startSession = useCallback(
    (user) => {
      // Drop anything cached for the previous visitor before showing the new session.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
      queryClient.setQueryData(['me'], user);
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
      isAdmin: user?.role === 'admin',
      isOwner: Boolean(user?.isOwner),
      // Which parts of the admin panel this admin may manage; the owner has them all.
      can: (area) => user?.role === 'admin' && (user.isOwner || (user.adminPermissions ?? []).includes(area)),
      isSeller: user?.role === 'seller' && user?.sellerProfile?.status === 'approved',
      login: async (credentials) =>
        startSession((await api('/auth/login', { method: 'POST', body: credentials })).user),
      register: async (details) =>
        startSession((await api('/auth/register', { method: 'POST', body: details })).user),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        queryClient.clear();
        queryClient.setQueryData(['me'], null);
      },
      setUser: (next) => queryClient.setQueryData(['me'], next),
      retry: () => me.refetch(),
    };
  }, [me, queryClient, startSession]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export const useAuth = () => use(AuthContext);
