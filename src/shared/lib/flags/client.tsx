'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { FLAG_COOKIE, serializeFlags, type FlagName, type FlagState } from './flags';

const FlagsContext = createContext<{
  flags: FlagState;
  setFlag: (name: FlagName, on: boolean) => void;
} | null>(null);

/** Server reads the cookie and passes the initial state in. */
export function FlagsProvider({ initial, children }: { initial: FlagState; children: ReactNode }) {
  const [flags, setFlags] = useState(initial);
  const setFlag = useCallback((name: FlagName, on: boolean) => {
    setFlags((prev) => {
      const next = { ...prev, [name]: on };
      document.cookie = `${FLAG_COOKIE}=${serializeFlags(next)}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);
  return <FlagsContext.Provider value={{ flags, setFlag }}>{children}</FlagsContext.Provider>;
}

export function useFlags() {
  const ctx = useContext(FlagsContext);
  if (!ctx) throw new Error('useFlags must be used inside <FlagsProvider>');
  return ctx;
}

export function useFlag(name: FlagName): boolean {
  return useFlags().flags[name];
}
