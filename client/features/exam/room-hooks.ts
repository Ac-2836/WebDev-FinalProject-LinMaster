'use client';

import type {AttemptState} from '@linmaster/shared';
import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';

import {ApiError, api, apiResponse} from '@/core/api/client';

import type {SaveState} from './exam-room';
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

const SAVE_DELAY_MS = 800;
const RETRY_MS = 5000;

/**
 * Autosave of the attempt state (`PUT /attempts/:id/state`): a short pause after each change, again when the
 * connection comes back, and every few seconds after a failed save. `onClosed` runs when the server refuses
 * because the time is over or the attempt was submitted. `flush()` waits for the last save and tells whether it
 * went through: call it before submitting, or the answer typed just before would not be graded.
 */
export function useAutosave(attemptId: string, state: AttemptState, onClosed: () => void) {
  const online = useOnline();
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const latest = useRef(state);
  // The state loaded from the server (at mount) counts as saved.
  const saved = useRef(state);
  const inFlight = useRef<Promise<void> | null>(null);
  const closed = useRef(onClosed);
  useEffect(() => {
    latest.current = state;
    closed.current = onClosed;
  });

  const flush = useCallback(async () => {
    while (inFlight.current) await inFlight.current;
    const next = latest.current;
    if (next === saved.current) return true;
    inFlight.current = api(`/attempts/${attemptId}/state`, {method: 'PUT', body: {state: next}})
      .then(() => {
        saved.current = next;
        if (latest.current === next) setSaveState('saved');
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && (error.status === 'ATTEMPT_EXPIRED' || error.status === 'ATTEMPT_SUBMITTED')) {
          saved.current = next;
          closed.current();
        } else setSaveState('error');
      })
      .finally(() => (inFlight.current = null));
    await inFlight.current;
    return saved.current === next;
  }, [attemptId]);

  useEffect(() => {
    if (state === saved.current) return;
    setSaveState(s => (s === 'error' ? s : 'saving'));
    if (!online) return;
    const id = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(id);
  }, [state, online, flush]);

  // A reload or a closed tab inside the save delay would lose the last answer: send it as the page goes away.
  useEffect(() => {
    const onPageHide = () => {
      if (latest.current === saved.current) return;
      // shortcut: keepalive bodies are capped at 64 KB, enough for answers and notes; move to sendBeacon if notes grow.
      void apiResponse(`/attempts/${attemptId}/state`, {
        method: 'PUT',
        body: {state: latest.current},
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [attemptId]);

  useEffect(() => {
    if (saveState !== 'error' || !online) return;
    const id = setTimeout(flush, RETRY_MS);
    return () => clearTimeout(id);
  }, [saveState, online, flush]);

  return {saveState, flush};
}
