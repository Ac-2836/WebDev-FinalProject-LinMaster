'use client';

import {StudySessionResponseSchema, type StudyMode} from '@linmaster/shared';
import {useCallback, useEffect, useRef} from 'react';

import {api} from '@/core/api/client';

/**
 * One study session (`POST /flashcards/sessions` on mount, `PATCH` once at the end) so the dashboard can count study time.
 * Session calls are best effort: a failure never blocks studying.
 */
export function useStudySession(setId: string, mode: StudyMode, enabled: boolean) {
  const id = useRef<Promise<string | null> | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    // The ref survives React's dev double-mount, so only one session is started.
    if (!enabled || id.current) return;
    id.current = api('/flashcards/sessions', {method: 'POST', body: {setId, mode}})
      .then(res => StudySessionResponseSchema.parse(res).session.id)
      .catch(() => null);
  }, [enabled, setId, mode]);

  /** Learn counts come from the reviews on the server; other modes send their own counts. */
  const end = useCallback(async (counts?: {cardsStudied: number; correctCount?: number}) => {
    if (ended.current || !id.current) return;
    ended.current = true;
    const sessionId = await id.current;
    if (sessionId)
      await api(`/flashcards/sessions/${sessionId}`, {method: 'PATCH', body: counts ?? {}}).catch(() => {});
  }, []);

  const sessionId = useCallback(async () => (id.current ? await id.current : null), []);
  return {end, sessionId};
}

/** Global shortcut keys for study modes; ignored while typing or with modifier keys. */
export function useStudyKeys(handler: (key: string, event: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
        return;
      ref.current(e.key, e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
