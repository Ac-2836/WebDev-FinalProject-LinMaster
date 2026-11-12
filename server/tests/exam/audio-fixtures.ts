// Small MP3 / M4A buffers with valid headers, for upload and duration tests.

/** MPEG-1 Layer III, 128 kbps, 44.1 kHz, stereo. */
const MP3_FRAME_HEADER = [0xff, 0xfb, 0x90, 0x00];

/** Constant bitrate MP3 of `seconds` (size × 8 / 128 kbps), after an empty ID3v2 tag. */
export function cbrMp3(seconds: number): Buffer {
  const id3 = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]);
  const frames = Buffer.alloc((seconds * 128_000) / 8);
  Buffer.from(MP3_FRAME_HEADER).copy(frames);
  return Buffer.concat([id3, frames]);
}

/** Variable bitrate MP3 whose Xing header gives the frame count (1152 samples per frame). */
export function xingMp3(frameCount: number): Buffer {
  const data = Buffer.alloc(2000);
  Buffer.from(MP3_FRAME_HEADER).copy(data);
  data.write('Xing', 4 + 32, 'latin1');
  data.writeUInt32BE(1, 40); // flags: frame count present
  data.writeUInt32BE(frameCount, 44);
  return data;
}

function box(type: string, ...children: Buffer[]): Buffer {
  const body = Buffer.concat(children);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, body]);
}

/** M4A with an `mvhd` (version 0) of `seconds` at a 1000 Hz timescale. */
export function m4a(seconds: number): Buffer {
  const mvhd = Buffer.alloc(20);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(seconds * 1000, 16);
  return Buffer.concat([box('ftyp', Buffer.from('M4A \0\0\0\0', 'latin1')), box('moov', box('mvhd', mvhd))]);
}
