import {describe, expect, it} from 'vitest';
import {ParseAudioOutputSchema} from '@linmaster/shared';
import {isAudioTranscriptComplete, parseAudioTask} from '../../src/modules/exam/ai/parse-audio.v1';

const input = {audio: Buffer.from('ID3'), mimeType: 'audio/mpeg', parts: 2, durationSec: 1680};
const part = (n: number, startSec: number, lines = 1) => ({
  part: n,
  startSec,
  lines: Array.from({length: lines}, () => ({label: null, text: 'Hello.'})),
});

describe('parse-audio.v1', () => {
  it('sends the recording with the number of parts', () => {
    const prompt = parseAudioTask.buildPrompt(input);

    expect(prompt.audio).toEqual({data: input.audio, mimeType: 'audio/mpeg'});
    expect(prompt.pdf).toBeUndefined();
    expect(prompt.text).toContain('Listening parts in the recording: 2');
  });

  it('is complete when every part has lines and the starts are in order inside the recording', () => {
    expect(isAudioTranscriptComplete({parts: [part(1, 0), part(2, 400)]}, input)).toBe(true);
    expect(isAudioTranscriptComplete({parts: [part(2, 400), part(1, 0)]}, input)).toBe(true);
    expect(isAudioTranscriptComplete({parts: [part(1, 0), part(2, 400)]}, {...input, durationSec: null})).toBe(true);
  });

  it('is not complete with a missing part, an empty part, starts out of order or after the end', () => {
    expect(isAudioTranscriptComplete({parts: [part(1, 0)]}, input)).toBe(false);
    expect(isAudioTranscriptComplete({parts: [part(1, 0), part(2, 400, 0)]}, input)).toBe(false);
    expect(isAudioTranscriptComplete({parts: [part(1, 500), part(2, 400)]}, input)).toBe(false);
    expect(isAudioTranscriptComplete({parts: [part(1, 0), part(2, 1680)]}, input)).toBe(false);
  });

  it('accepts only whole-second, non-negative starts', () => {
    expect(ParseAudioOutputSchema.safeParse({parts: [part(1, 0)]}).success).toBe(true);
    expect(ParseAudioOutputSchema.safeParse({parts: [part(1, -1)]}).success).toBe(false);
    expect(ParseAudioOutputSchema.safeParse({parts: [part(1, 1.5)]}).success).toBe(false);
  });
});
