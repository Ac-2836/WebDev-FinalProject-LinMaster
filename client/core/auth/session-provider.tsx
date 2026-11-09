'use client';

import {useRouter} from 'next/navigation';
import {createContext, useContext, useMemo, useState} from 'react';

import {safeNext} from './redirect';
import {clearToken, setToken} from './token';

interface Session {
  signedIn: boolean;
  /** Saves the JWT from login/register and goes to `next` (only same-site paths). */
  signIn: (token: string, next?: string | null) => void;
  signOut: () => void;
}

const SessionContext = createContext<Session | null>(null);

interface SessionProviderProps {
  /** Read from the cookie on the server so the first render already knows. */
  initialSignedIn: boolean;
  children: React.ReactNode;
}

/** Login session (PLAN C0). The user profile (`GET /auth/me`) joins this in P1-11. */
export function SessionProvider({initialSignedIn, children}: SessionProviderProps) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(initialSignedIn);

  const session = useMemo<Session>(
    () => ({
      signedIn,
      signIn: (token, next) => {
        setToken(token);
        setSignedIn(true);
        router.replace(safeNext(next));
      },
      signOut: () => {
        clearToken();
        setSignedIn(false);
        router.replace('/login');
      },
    }),
    [signedIn, router],
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}
