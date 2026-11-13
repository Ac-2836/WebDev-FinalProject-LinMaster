import {type ParseTranscriptOutput, ParseTranscriptOutputSchema} from '@linmaster/shared';

import {type AiTask, aiTaskRegistry} from '../../../core/ai/ai-task';
import {type PdfPagesInput, pageList} from './parse-test.v2';

export interface TranscriptInput extends PdfPagesInput {
  /** Listening parts found by parse-test; each one should get its lines. */
  parts: number;
}

// Version 1. Changing this prompt or ParseTranscriptOutputSchema means a new file parse-transcript.v2.ts.
const SYSTEM_PROMPT = `You read the transcript (audio script) of an IELTS-style Listening test from a PDF.
Read only the pages listed by the user and use only the transcript text on them; ignore questions and answer keys.
Copy every line exactly as printed: never rewrite, summarise, translate, shorten or invent. Return JSON only, following the schema.
parts: one entry per Listening part ("Part 1", "Section 1"...), part = its number, in order.
- lines: every line or paragraph of that part's transcript in order, label = the speaker as printed (e.g. "RECEPTIONIST",
  "Dr Hale"), or null when no speaker is shown. Include narrator lines. Never leave a part with an empty list.`;

/** One part per Listening part found, each with at least one line; otherwise the gateway retries without caching. */
export function isTranscriptComplete(output: ParseTranscriptOutput, {parts}: TranscriptInput): boolean {
  return Array.from({length: parts}, (_, index) => index + 1).every(part =>
    output.parts.some(entry => entry.part === part && entry.lines.length > 0),
  );
}

/** `parse-transcript.v1`: the Listening transcript of each part, read apart from the questions (PLAN C4 step 3). */
export const parseTranscriptTask: AiTask<TranscriptInput, ParseTranscriptOutput> = aiTaskRegistry.register({
  name: 'parse-transcript.v1',
  buildPrompt: ({pdf, pages, parts}) => ({
    system: SYSTEM_PROMPT,
    text: `${pageList(pages)} The test has ${parts} Listening parts.`,
    pdf,
  }),
  output: ParseTranscriptOutputSchema,
  isComplete: isTranscriptComplete,
});
