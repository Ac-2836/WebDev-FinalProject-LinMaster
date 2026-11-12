import {describe, expect, it} from 'vitest';
import {readAudioDurationSec} from '../../src/modules/exam/audio-duration';
import {cbrMp3, m4a, xingMp3} from './audio-fixtures';

describe('readAudioDurationSec', () => {
  it('reads a constant bitrate MP3 from its size and bitrate', () => {
    expect(readAudioDurationSec(cbrMp3(10), 'audio/mpeg')).toBe(10);
    expect(readAudioDurationSec(cbrMp3(1800), 'audio/mpeg')).toBe(1800);
  });

  it('reads a variable bitrate MP3 from its Xing frame count', () => {
    // 383 frames × 1152 samples / 44 100 Hz ≈ 10.005 s; the file itself is only 2 000 bytes.
    expect(readAudioDurationSec(xingMp3(383), 'audio/mpeg')).toBe(10);
  });

  it('reads an M4A from its movie header', () => {
    expect(readAudioDurationSec(m4a(1800), 'audio/mp4')).toBe(1800);
    expect(readAudioDurationSec(m4a(95), 'audio/mp4')).toBe(95);
  });

  it('returns null for a file without a readable header or shorter than a second', () => {
    expect(
      readAudioDurationSec(Buffer.from('ID3\x04\0\0\0\0\0\0' + '\0'.repeat(100), 'latin1'), 'audio/mpeg'),
    ).toBeNull();
    expect(readAudioDurationSec(Buffer.alloc(0), 'audio/mpeg')).toBeNull();
    expect(readAudioDurationSec(Buffer.from('....ftypM4A ', 'latin1'), 'audio/mp4')).toBeNull();
    expect(readAudioDurationSec(xingMp3(0), 'audio/mpeg')).toBeNull();
  });
});
