// Reads the length of an MP3 or M4A file from its headers (PLAN C4 step 1: audio needs no AI), without a library.

/** M4A: `moov` → `mvhd` holds the timescale and the duration. */
function m4aDurationSec(data: Buffer): number | null {
  const findBox = (type: string, start: number, end: number): [number, number] | null => {
    let offset = start;
    while (offset + 8 <= end) {
      let size = data.readUInt32BE(offset);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > end) return null;
        size = Number(data.readBigUInt64BE(offset + 8));
        header = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < header) return null;
      if (data.toString('latin1', offset + 4, offset + 8) === type) {
        return [offset + header, Math.min(offset + size, end)];
      }
      offset += size;
    }
    return null;
  };

  const moov = findBox('moov', 0, data.length);
  const mvhd = moov && findBox('mvhd', moov[0], moov[1]);
  if (!mvhd) return null;
  const [body, end] = mvhd;
  const version = data[body];
  const timescaleAt = body + (version === 1 ? 20 : 12);
  if (timescaleAt + (version === 1 ? 12 : 8) > end) return null;
  const timescale = data.readUInt32BE(timescaleAt);
  const duration = version === 1 ? Number(data.readBigUInt64BE(timescaleAt + 4)) : data.readUInt32BE(timescaleAt + 4);
  return timescale > 0 ? duration / timescale : null;
}

const BITRATES_KBPS = {
  v1l1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  v1l2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  v1l3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2l1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  v2l23: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SAMPLE_RATES: Readonly<Record<number, readonly number[]>> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

/** MP3: frame count from a Xing/Info or VBRI header (VBR), else the file size and the bitrate (CBR). */
function mp3DurationSec(data: Buffer): number | null {
  let offset = 0;
  if (data.toString('latin1', 0, 3) === 'ID3' && data.length >= 10) {
    const size = ((data[6] & 0x7f) << 21) | ((data[7] & 0x7f) << 14) | ((data[8] & 0x7f) << 7) | (data[9] & 0x7f);
    offset = 10 + size + (data[5] & 0x10 ? 10 : 0);
  }
  const searchEnd = Math.min(data.length - 4, offset + 64 * 1024);
  while (offset < searchEnd && !(data[offset] === 0xff && (data[offset + 1] & 0xe0) === 0xe0)) offset++;
  if (offset >= searchEnd) return null;

  const version = (data[offset + 1] >> 3) & 3;
  const layer = (data[offset + 1] >> 1) & 3; // 3 = Layer I, 2 = Layer II, 1 = Layer III
  const bitrateIndex = data[offset + 2] >> 4;
  const sampleRate = SAMPLE_RATES[version]?.[(data[offset + 2] >> 2) & 3];
  if (version === 1 || layer === 0 || !sampleRate || bitrateIndex === 0 || bitrateIndex === 15) return null;
  const mpeg1 = version === 3;
  const table = mpeg1
    ? [BITRATES_KBPS.v1l3, BITRATES_KBPS.v1l2, BITRATES_KBPS.v1l1][layer - 1]
    : layer === 3
      ? BITRATES_KBPS.v2l1
      : BITRATES_KBPS.v2l23;
  const bitrate = table[bitrateIndex] * 1000;
  const samplesPerFrame = layer === 3 ? 384 : layer === 2 || mpeg1 ? 1152 : 576;

  const mono = data[offset + 3] >> 6 === 3;
  const xingAt = offset + 4 + (mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17);
  const tag = data.toString('latin1', xingAt, xingAt + 4);
  if ((tag === 'Xing' || tag === 'Info') && data[xingAt + 7] & 1 && xingAt + 12 <= data.length) {
    return (data.readUInt32BE(xingAt + 8) * samplesPerFrame) / sampleRate;
  }
  if (data.toString('latin1', offset + 36, offset + 40) === 'VBRI' && offset + 50 <= data.length) {
    return (data.readUInt32BE(offset + 50) * samplesPerFrame) / sampleRate;
  }
  const id3v1 = data.length >= 128 && data.toString('latin1', data.length - 128, data.length - 125) === 'TAG';
  return ((data.length - offset - (id3v1 ? 128 : 0)) * 8) / bitrate;
}

/** Whole seconds of audio, or null when the file does not have a readable header. */
export function readAudioDurationSec(data: Buffer, mimeType: string): number | null {
  try {
    const seconds = mimeType === 'audio/mp4' ? m4aDurationSec(data) : mp3DurationSec(data);
    return seconds !== null && Number.isFinite(seconds) && seconds >= 1 ? Math.round(seconds) : null;
  } catch {
    return null;
  }
}
