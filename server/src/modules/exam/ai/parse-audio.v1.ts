import {type ParseAudioOutput, ParseAudioOutputSchema} from '@linmaster/shared';

import {type AiTask, aiTaskRegistry} from '../../../core/ai/ai-task';

export interface ParseAudioInput {
  audio: Buffer;
  mimeType: string;
  /** Listening parts found by parse-test; each one should get its lines and start. */
  parts: number;
  /** Length of the recording, when known: a part cannot start after it. */
  durationSec: number | null;
}

// Version 1. Changing this prompt or ParseAudioOutputSchema means a new file parse-audio.v2.ts.
const SYSTEM_PROMPT = `You listen to the recording of an IELTS-style Listening test and write its transcript.
Write only what is said, as it is said: never summarise, translate, correct or invent words. Return JSON only, following the schema.
parts: one entry per Listening part ("Part 1", "Section 1"...), part = its number, in order.
- startSec: the second of the recording where the speech of that part begins (its introduction), a whole number; Part 1 may start at 0. A later part never starts before an earlier one.
- lines: what is said in that part, in order, as short paragraphs. label = the speaker's role or name when it is clear (e.g. "Receptionist", "Dr Hale"), or null when it is not. Include the narrator. Never leave a part with an empty list.
Do not transcribe the pauses in which candidates read the questions, and write numbers the way a transcript prints them.`;

/**
 * One part per Listening part found, each with at least one line, starts in order and inside the recording;
 * otherwise the gateway retries without caching.
 */
export function isAudioTranscriptComplete(output: ParseAudioOutput, {parts, durationSec}: ParseAudioInput): boolean {
  const entries = Array.from({length: parts}, (_, index) => output.parts.find(entry => entry.part === index + 1));
  if (entries.some(entry => !entry || entry.lines.length === 0)) return false;
  const starts = entries.map(entry => entry!.startSec);
  const ordered = starts.every((start, index) => index === 0 || start >= starts[index - 1]!);
  return ordered && (durationSec === null || starts.every(start => start < durationSec));
}

/** `parse-audio.v1`: the Listening transcript and part starts, from the recording (PLAN C4 step 3, P3-18). */
export const parseAudioTask: AiTask<ParseAudioInput, ParseAudioOutput> = aiTaskRegistry.register({
  name: 'parse-audio.v1',
  buildPrompt: ({audio, mimeType, parts}) => ({
    system: SYSTEM_PROMPT,
    text: `Number of Listening parts in the recording: ${parts}.`,
    audio: {data: audio, mimeType},
  }),
  output: ParseAudioOutputSchema,
  isComplete: isAudioTranscriptComplete,
});
