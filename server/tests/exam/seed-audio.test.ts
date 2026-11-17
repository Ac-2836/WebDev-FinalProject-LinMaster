import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {seedSampleTests} from '../../prisma/seed-tests';
import {getDb} from '../../src/core/db';
import {storage} from '../../src/core/storage';

// Q-28: the demo Listening test must come with audio when SEED_LISTENING_AUDIO points to a file, and re-running the
// seed must replace the test and its file instead of piling them up.
describe('seed of the sample Listening test', () => {
  const db = getDb();
  const email = `seed-audio-${Date.now()}@linmaster.test`;
  const folder = mkdtempSync(path.join(tmpdir(), 'linmaster-seed-'));
  const audioPath = path.join(folder, 'listening.mp3');
  const saved = process.env.SEED_LISTENING_AUDIO;
  let userId: string;

  beforeAll(async () => {
    userId = (await db.user.create({data: {email, passwordHash: 'x', displayName: 'Seed audio'}})).id;
    writeFileSync(audioPath, Buffer.concat([Buffer.from('ID3'), Buffer.alloc(2000)]));
  });

  afterAll(async () => {
    process.env.SEED_LISTENING_AUDIO = saved;
    if (saved === undefined) delete process.env.SEED_LISTENING_AUDIO;
    const files = await db.storedFile.findMany({where: {ownerId: userId}, select: {storageKey: true}});
    await Promise.all(files.map(file => storage.delete(file.storageKey)));
    await db.user.deleteMany({where: {email}});
    await db.$disconnect();
    rmSync(folder, {recursive: true, force: true});
  });

  const listeningAudio = async () =>
    (
      await db.testSection.findMany({
        where: {skill: 'listening', test: {ownerId: userId}},
        select: {audioFile: {select: {id: true, storageKey: true, durationSec: true, mimeType: true}}},
      })
    ).map(section => section.audioFile);

  it('gives the Listening test its audio, and a second run replaces the test and the file', async () => {
    process.env.SEED_LISTENING_AUDIO = audioPath;

    await seedSampleTests(db, userId);
    const [first] = await listeningAudio();
    const storedBefore = await storage.get(first!.storageKey);
    await seedSampleTests(db, userId);
    const [second] = await listeningAudio();

    expect(first).toMatchObject({mimeType: 'audio/mpeg', durationSec: 843});
    expect(storedBefore).not.toBeNull();
    expect(second!.id).not.toBe(first!.id);
    expect(await storage.get(first!.storageKey)).toBeNull();
    expect(await db.storedFile.count({where: {ownerId: userId}})).toBe(1);
    expect(await db.test.count({where: {ownerId: userId}})).toBe(2);
  });

  it('seeds the Listening test without audio, and says so, when the file is missing', async () => {
    process.env.SEED_LISTENING_AUDIO = path.join(folder, 'missing.mp3');

    await seedSampleTests(db, userId);

    expect(await listeningAudio()).toEqual([null]);
    expect(await db.storedFile.count({where: {ownerId: userId}})).toBe(0);
  });
});
