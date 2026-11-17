import {describe, expect, it} from 'vitest';
import {ParseAudioOutputSchema} from '@linmaster/shared';
import {isAudioTranscriptComplete, parseAudioTask} from '../../src/modules/exam/ai/parse-audio.v2';

const input = {audio: Buffer.from('ID3'), mimeType: 'audio/mpeg', parts: 2};
const part = (n: number, lines = 1) => ({
  part: n,
  lines: Array.from({length: lines}, () => ({label: null, text: 'Hello.'})),
});

describe('parse-audio.v2', () => {
  it('sends the recording with the number of parts, and asks for no start second', () => {
    const prompt = parseAudioTask.buildPrompt(input);

    expect(parseAudioTask.name).toBe('parse-audio.v2');
    expect(prompt.audio).toEqual({data: input.audio, mimeType: 'audio/mpeg'});
    expect(prompt.pdf).toBeUndefined();
    expect(prompt.text).toContain('Listening parts in the recording: 2');
    expect(prompt.system).not.toMatch(/startSec|second/i);
  });

  it('is complete when every part has lines', () => {
    expect(isAudioTranscriptComplete({parts: [part(1), part(2, 5)]}, input)).toBe(true);
    expect(isAudioTranscriptComplete({parts: [part(2), part(1)]}, input)).toBe(true);
  });

  it('is not complete with a missing or an empty part', () => {
    expect(isAudioTranscriptComplete({parts: [part(1)]}, input)).toBe(false);
    expect(isAudioTranscriptComplete({parts: [part(1), part(2, 0)]}, input)).toBe(false);
  });

  it('has no start second in its output schema', () => {
    expect(ParseAudioOutputSchema.safeParse({parts: [part(1)]}).success).toBe(true);
    expect(Object.keys(ParseAudioOutputSchema.shape.parts.element.shape)).toEqual(['part', 'lines']);
  });
});
