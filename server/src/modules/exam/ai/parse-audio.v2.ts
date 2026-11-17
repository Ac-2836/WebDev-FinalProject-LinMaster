import {type ParseAudioOutput, ParseAudioOutputSchema} from '@linmaster/shared';

import {type AiTask, aiTaskRegistry} from '../../../core/ai/ai-task';

export interface ParseAudioInput {
  audio: Buffer;
  mimeType: string;
  /** Listening parts found by parse-test; each one should get its lines. */
  parts: number;
}

// Version 2: no start second per part (the model's marks were off by minutes). The prompt stays this short on
// purpose: with real audio, longer instructions (one line per turn, skip the pauses) made Gemini drop half of a part.
// Changing this prompt or ParseAudioOutputSchema means a new file parse-audio.v3.ts.
const SYSTEM_PROMPT = `You listen to the recording of an IELTS-style Listening test and write its transcript.
Return JSON only, following the schema. parts: one entry per Listening part, part = its number, in order.
lines: what is said in that part, in order, as short paragraphs. label = the speaker's role or name when clear, or null. Include the narrator. Never leave a part with an empty list.
Write the whole recording, from the first word to the last: never summarise, shorten, skip a passage, stop early, translate, correct or invent words.`;

/** One part per Listening part found, each with at least one line; otherwise the gateway retries without caching. */
export function isAudioTranscriptComplete(output: ParseAudioOutput, {parts}: ParseAudioInput): boolean {
  return Array.from({length: parts}, (_, index) => index + 1).every(part =>
    output.parts.some(entry => entry.part === part && entry.lines.length > 0),
  );
}

/** `parse-audio.v2`: the Listening transcript of each part, from the recording (PLAN C4 step 3, P3-18). */
export const parseAudioTask: AiTask<ParseAudioInput, ParseAudioOutput> = aiTaskRegistry.register({
  name: 'parse-audio.v2',
  buildPrompt: ({audio, mimeType, parts}) => ({
    system: SYSTEM_PROMPT,
    text: `Number of Listening parts in the recording: ${parts}.`,
    audio: {data: audio, mimeType},
  }),
  output: ParseAudioOutputSchema,
  isComplete: isAudioTranscriptComplete,
});
