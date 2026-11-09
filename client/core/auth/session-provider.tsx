'use client';

import {AuthUserResponseSchema, type AuthPublicUser} from '@linmaster/shared';
import {useRouter} from 'next/navigation';
import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';

import {api} from '@/core/api/client';
import {setLocale} from '@/core/i18n/actions';

import {safeNext} from './redirect';
import {clearToken, setToken} from './token';

/** `anonymous`: no session. `loading`/`error`: signed in, profile (`GET /auth/me`) not loaded yet / failed. */
export type SessionStatus = 'anonymous' | 'loading' | 'ready' | 'error';

interface Session {
  status: SessionStatus;
  user: AuthPublicUser | null;
  /** After login/register: saves the JWT, applies the user's language and goes to `next` (same-site paths only). */
  signIn: (token: string, user: AuthPublicUser, next?: string | null) => Promise<void>;
  signOut: () => void;
  /** Replace the cached profile after `PATCH /auth/me`. */
  setUser: (user: AuthPublicUser) => void;
  /** Load the profile again (retry after an error). */
  reload: () => void;
}

const SessionContext = createContext<Session | null>(null);

interface SessionProviderProps {
  /** Read from the cookie on the server so the first render already knows. */
  initialSignedIn: boolean;
  children: React.ReactNode;
}

/** Login session (PLAN C0): token in a cookie, profile from `GET /auth/me`. */
export function SessionProvider({initialSignedIn, children}: SessionProviderProps) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  const [user, setUser] = useState<AuthPublicUser | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!signedIn || user) return;
    let cancelled = false;
    api('/auth/me')
      .then(res => !cancelled && setUser(AuthUserResponseSchema.parse(res).user))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [signedIn, user, attempt]);

  const reload = useCallback(() => {
    setFailed(false);
    setAttempt(n => n + 1);
  }, []);

  const session = useMemo<Session>(() => {
    const status: SessionStatus = !signedIn ? 'anonymous' : user ? 'ready' : failed ? 'error' : 'loading';
    return {
      status,
      user,
      setUser,
      reload,
      signIn: async (token, nextUser, next) => {
        setToken(token);
        setUser(nextUser);
        setFailed(false);
        setSignedIn(true);
        await setLocale(nextUser.locale);
        router.replace(safeNext(next));
        router.refresh();
      },
      signOut: () => {
        clearToken();
        setUser(null);
        setSignedIn(false);
        router.replace('/');
        router.refresh();
      },
    };
  }, [signedIn, user, failed, reload, router]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}
