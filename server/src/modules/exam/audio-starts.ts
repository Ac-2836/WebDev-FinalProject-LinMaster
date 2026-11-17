/**
 * Start second of each Listening part (index = part - 1) that can be trusted: inside the recording, and not before
 * the part before it. A mark that fails is left `null` rather than saved wrong, so the room does not seek to a
 * bad place; the transcript is kept either way.
 */
export function trustedStarts(
  parts: {part: number; startSec: number}[],
  partCount: number,
  durationSec: number | null,
): (number | null)[] {
  let last = 0;
  return Array.from({length: partCount}, (_, index) => {
    const startSec = parts.find(entry => entry.part === index + 1)?.startSec;
    if (startSec === undefined || startSec < last || (durationSec !== null && startSec >= durationSec)) return null;
    last = startSec;
    return startSec;
  });
}
