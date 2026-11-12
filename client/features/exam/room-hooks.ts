'use client';

import {useEffect, useRef, useState, useSyncExternalStore} from 'react';

import {clockOffset, crossedWarning, remainingMs, type WarningMinute} from './room-logic';

/**
 * Ms left until `deadlineAt`, ticking every second on the server clock. `null` until mounted
 * (no device time during server render). Calls `onWarn` at 10 and 5 minutes and `onExpire` once at 0.
 */
export function useCountdown(
  deadlineAt: string,
  serverNow: string,
  onExpire: () => void,
  onWarn?: (minutes: WarningMinute) => void,
) {
  const [ms, setMs] = useState<number | null>(null);
  const handlers = useRef({onExpire, onWarn});
  useEffect(() => {
    handlers.current = {onExpire, onWarn};
  });

  useEffect(() => {
    const offset = clockOffset(serverNow, Date.now());
    let prev: number | null = null;
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const next = remainingMs(deadlineAt, offset, Date.now());
      setMs(next);
      const warning = crossedWarning(prev, next);
      if (warning) handlers.current.onWarn?.(warning);
      prev = next;
      if (next === 0) {
        clearInterval(id);
        handlers.current.onExpire();
        return false;
      }
      return true;
    };
    if (tick()) id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineAt, serverNow]);

  return ms;
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** Browser connection state; the caller re-sends unsaved answers when it turns back to true. */
export const useOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

/** Ask before closing or reloading the tab while the attempt is open. */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}

export const TEXT_SIZES = ['standard', 'large', 'xlarge'] as const;
export const COLOUR_SCHEMES = ['bw', 'wb', 'cream'] as const;
export interface RoomSettings {
  textSize: (typeof TEXT_SIZES)[number];
  colours: (typeof COLOUR_SCHEMES)[number];
}

const SETTINGS_KEY = 'lm_exam_settings';
const DEFAULT_SETTINGS: RoomSettings = {textSize: 'standard', colours: 'bw'};

function readSettings(): RoomSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<RoomSettings>;
    return {
      textSize: TEXT_SIZES.includes(saved.textSize!) ? saved.textSize! : DEFAULT_SETTINGS.textSize,
      colours: COLOUR_SCHEMES.includes(saved.colours!) ? saved.colours! : DEFAULT_SETTINGS.colours,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Text size and colours, kept on this device so a reload keeps them. */
export function useRoomSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // localStorage only exists after mount.
  useEffect(() => {
    setSettings(readSettings());
  }, []);
  const update = (patch: Partial<RoomSettings>) =>
    setSettings(prev => {
      const next = {...prev, ...patch};
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Private mode: settings last for this page only.
      }
      return next;
    });
  return [settings, update] as const;
}
