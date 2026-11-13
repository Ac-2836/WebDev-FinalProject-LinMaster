'use client';

import type {AttemptAudio} from '@linmaster/shared';
import {useCallback, useEffect, useRef, useState} from 'react';

import {apiResponse} from '@/core/api/client';

import {needsResync, resumePoint} from './audio-logic';

/**
 * - `waiting`: loading the first chunk.
 * - `blocked`: the browser refused to start sound without a click (after a refresh); `resume()` starts it.
 * - `none`: the test has no audio, or this browser cannot stream MP3.
 */
export type AudioStatus = 'waiting' | 'blocked' | 'playing' | 'ended' | 'none' | 'error';

const PULL_MS = 5000;
/** Played audio kept in the buffer; older data is removed to stay under the browser's buffer quota. */
const KEEP_BEHIND_SEC = 30;
const VOLUME_KEY = 'lm_exam_volume';

function readVolume() {
  try {
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    return saved > 0 && saved <= 1 ? saved : 1;
  } catch {
    return 1;
  }
}

/**
 * Listening audio of the running section (PLAN C4): streamed from `GET /attempts/:id/audio` (which needs the
 * Authorization header, hence MediaSource instead of `<audio src>`), started at the position the server gives,
 * and it cannot be paused or sought. The server sends only up to 30 s ahead, so chunks are fetched as time goes.
 */
export function useExamAudio(audio: AttemptAudio | null) {
  const [status, setStatus] = useState<AudioStatus>(() => (!audio ? 'none' : audio.ended ? 'ended' : 'waiting'));
  const [volume, setVolume] = useState(readVolume);
  const element = useRef<HTMLAudioElement | null>(null);
  // Seconds the audio should be at now, on the server clock.
  const expected = useRef<() => number>(() => 0);

  useEffect(() => {
    if (!audio || audio.ended) return;
    if (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported('audio/mpeg')) {
      setStatus('none');
      return;
    }
    const loadedAt = performance.now();
    expected.current = () => audio.positionSec + (performance.now() - loadedAt) / 1000;

    const media = new MediaSource();
    const player = new Audio();
    player.volume = readVolume();
    player.src = URL.createObjectURL(media);
    element.current = player;
    let stopped = false;
    let started = false;
    let nextByte = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // No pause: anything that stops the sound (a media key, the OS) starts it again.
    const keepPlaying = () => {
      if (!stopped && !player.ended && started) void player.play().catch(() => setStatus('blocked'));
    };
    player.addEventListener('pause', keepPlaying);
    player.addEventListener('ended', () => setStatus('ended'));

    const start = () => {
      started = true;
      player.currentTime = expected.current();
      player
        .play()
        .then(() => setStatus('playing'))
        .catch(() => setStatus('blocked'));
    };

    media.addEventListener('sourceopen', () => {
      const buffer = media.addSourceBuffer('audio/mpeg');
      const done = () => new Promise(resolve => buffer.addEventListener('updateend', resolve, {once: true}));

      const pull = async () => {
        if (stopped) return;
        try {
          const res = await apiResponse(audio.streamPath, {headers: {Range: `bytes=${nextByte}-`}});
          if (stopped) return;
          if (res.status === 206) {
            let data = await res.arrayBuffer();
            const received = data.byteLength;
            if (nextByte === 0) {
              const {skipBytes, startSec} = resumePoint(received, audio.positionSec, audio.durationSec);
              buffer.timestampOffset = startSec;
              data = data.slice(skipBytes);
            }
            nextByte += received;
            const played = player.currentTime - KEEP_BEHIND_SEC;
            if (buffer.buffered.length && buffer.buffered.start(0) < played) {
              buffer.remove(0, played);
              await done();
            }
            if (data.byteLength) {
              buffer.appendBuffer(data);
              await done();
            }
          } else if (res.status === 409) {
            // AUDIO_NOT_AVAILABLE: the server reached the end of the audio.
            if (media.readyState === 'open') media.endOfStream();
            if (!started) setStatus('ended');
            return;
          } else if (res.status !== 416) {
            // 416: nothing new yet.
            if (!started) setStatus('error');
          }
        } catch {
          // Offline: the buffered 30 s keep playing; try again on the next pull.
        }
        if (!started && buffer.buffered.length) start();
        else if (started && !player.paused && needsResync(player.currentTime, expected.current())) {
          player.currentTime = expected.current();
        }
        timer = setTimeout(() => void pull(), PULL_MS);
      };
      void pull();
    });

    return () => {
      stopped = true;
      clearTimeout(timer);
      player.removeEventListener('pause', keepPlaying);
      player.pause();
      URL.revokeObjectURL(player.src);
      player.removeAttribute('src');
      element.current = null;
    };
  }, [audio]);

  useEffect(() => {
    if (element.current) element.current.volume = volume;
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // Private mode: the volume lasts for this page only.
    }
  }, [volume]);

  /** After a refresh the browser needs a click to play sound; join the audio where it is now. */
  const resume = useCallback(() => {
    const player = element.current;
    if (!player) return;
    player.currentTime = expected.current();
    player
      .play()
      .then(() => setStatus('playing'))
      .catch(() => setStatus('blocked'));
  }, []);

  return {status, volume, setVolume, resume};
}
