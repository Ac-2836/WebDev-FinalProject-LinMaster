/** Seconds of audio the server sends ahead of the position (`AUDIO_LEAD_SEC` of the attempts service). */
export const AUDIO_LEAD_SEC = 30;
/** Start a little before the position, so the first sound is not cut. */
const REWIND_SEC = 2;

/**
 * Where to start playing the first chunk after a refresh. The server sends the file from byte 0 up to the
 * position plus `AUDIO_LEAD_SEC`, so the chunk tells the bytes per second of the file.
 * shortcut: assumes a constant bitrate MP3; a variable bitrate file starts a few seconds off, fine for IELTS audio.
 */
export function resumePoint(chunkBytes: number, positionSec: number, durationSec: number | null) {
  if (!durationSec || positionSec <= REWIND_SEC) return {skipBytes: 0, startSec: 0};
  const coveredSec = Math.min(durationSec, positionSec + AUDIO_LEAD_SEC);
  const bytesPerSec = chunkBytes / coveredSec;
  const startSec = positionSec - REWIND_SEC;
  return {skipBytes: Math.floor(bytesPerSec * startSec), startSec};
}

/** Seconds played drift from the server clock beyond this are corrected (a slow device, a tab in the background). */
export const MAX_DRIFT_SEC = 3;

export const needsResync = (currentSec: number, expectedSec: number) =>
  Math.abs(currentSec - expectedSec) > MAX_DRIFT_SEC;
