import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {getDb} from '../../src/core/db';
import {prismaImportRepository as repo} from '../../src/modules/exam/imports.repository';

const testRun = `${Date.now()}`;

describe('Prisma import repository', () => {
  const db = getDb();
  let ownerId: string;
  let otherUserId: string;

  const newFile = (mimeType = 'application/pdf') => ({
    storageKey: randomUUID(),
    mimeType,
    sizeBytes: 1024,
    originalName: 'test.pdf',
    durationSec: mimeType === 'application/pdf' ? null : 1800,
  });

  beforeAll(async () => {
    const create = (name: string) =>
      db.user.create({data: {email: `import-${name}-${testRun}@linmaster.test`, passwordHash: 'x', displayName: name}});
    ownerId = (await create('owner')).id;
    otherUserId = (await create('other')).id;
  });

  afterAll(async () => {
    const userIds = [ownerId, otherUserId].filter((id): id is string => id !== undefined);
    await db.testImport.deleteMany({where: {ownerId: {in: userIds}}});
    if (userIds.length > 0) await db.user.deleteMany({where: {id: {in: userIds}}});
    await db.$disconnect();
  });

  it('stores a file and finds it only for its owner', async () => {
    const file = await repo.createFile(ownerId, newFile('audio/mpeg'));

    expect(file).toMatchObject({ownerId, mimeType: 'audio/mpeg', durationSec: 1800});
    expect(await repo.findFile(ownerId, file.id)).toEqual(file);
    expect(await repo.findFile(otherUserId, file.id)).toBeNull();
  });

  it('deletes a free file once, and never a file of another user', async () => {
    const file = await repo.createFile(ownerId, newFile());

    expect(await repo.deleteFile(otherUserId, file.id)).toBe('missing');
    expect(await repo.deleteFile(ownerId, file.id)).toBe('deleted');
    expect(await repo.deleteFile(ownerId, file.id)).toBe('missing');
  });

  it('keeps files an import uses, including the audio whose foreign key would only set null', async () => {
    const pdf = await repo.createFile(ownerId, newFile());
    const audio = await repo.createFile(ownerId, newFile('audio/mpeg'));
    const testImport = await db.testImport.create({
      data: {ownerId, kind: 'listening', questionFileId: pdf.id, answerFileId: pdf.id, audioFileId: audio.id},
    });

    expect(await repo.deleteFile(ownerId, pdf.id)).toBe('in_use');
    expect(await repo.deleteFile(ownerId, audio.id)).toBe('in_use');
    expect(await repo.findFile(ownerId, pdf.id)).not.toBeNull();
    expect((await db.testImport.findUnique({where: {id: testImport.id}}))?.audioFileId).toBe(audio.id);
  });

  it('keeps the audio of a test section', async () => {
    const audio = await repo.createFile(ownerId, newFile('audio/mpeg'));
    const test = await db.test.create({
      data: {
        ownerId,
        certification: 'IELTS_ACADEMIC',
        kind: 'listening',
        title: `Import repo ${testRun}`,
        sections: {create: {skill: 'listening', position: 1, durationSec: 1800, audioFileId: audio.id}},
      },
    });

    expect(await repo.deleteFile(ownerId, audio.id)).toBe('in_use');
    await db.test.delete({where: {id: test.id}});
    expect(await repo.deleteFile(ownerId, audio.id)).toBe('deleted');
  });
});
