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

  it('finds the files of the user with whether an import uses them', async () => {
    const free = await repo.createFile(ownerId, newFile());
    const used = await repo.createFile(ownerId, newFile());
    const foreign = await repo.createFile(otherUserId, newFile());
    await db.testImport.create({data: {ownerId, kind: 'reading', questionFileId: used.id, answerFileId: used.id}});

    const found = await repo.findFiles(ownerId, [free.id, used.id, foreign.id]);

    expect(found.map(file => [file.id, file.inUse]).sort()).toEqual(
      [
        [free.id, false],
        [used.id, true],
      ].sort(),
    );
  });

  it('creates a queued import from one PDF, or stores the merged PDF with it', async () => {
    const pdf = await repo.createFile(ownerId, newFile());
    const audio = await repo.createFile(ownerId, newFile('audio/mpeg'));

    const single = await repo.createImport(ownerId, {kind: 'reading', pdf: {fileId: pdf.id}, audioFileId: null});
    const merged = await repo.createImport(ownerId, {
      kind: 'listening',
      pdf: {merged: {...newFile(), originalName: 'merged-test.pdf'}},
      audioFileId: audio.id,
    });

    expect(single).toMatchObject({ownerId, kind: 'reading', status: 'queued', testId: null, finishedAt: null});
    const mergedRow = await db.testImport.findUniqueOrThrow({where: {id: merged.id}, include: {questionFile: true}});
    expect(mergedRow).toMatchObject({audioFileId: audio.id, answerFileId: mergedRow.questionFileId});
    expect(mergedRow.questionFile).toMatchObject({ownerId, originalName: 'merged-test.pdf'});
    expect(await repo.findImport(ownerId, single.id)).toEqual(single);
    expect(await repo.findImport(otherUserId, single.id)).toBeNull();
  });

  it('stores no merged PDF when the import cannot be created', async () => {
    const storageKey = randomUUID();
    await expect(
      repo.createImport(ownerId, {
        kind: 'listening',
        pdf: {merged: {...newFile(), storageKey}},
        audioFileId: randomUUID(),
      }),
    ).rejects.toThrow();
    expect(await db.storedFile.count({where: {storageKey}})).toBe(0);
  });

  it('claims an unfinished import once it is queued, and stores the outcome once', async () => {
    const pdf = await repo.createFile(ownerId, newFile());
    const created = await repo.createImport(ownerId, {kind: 'reading', pdf: {fileId: pdf.id}, audioFileId: null});

    const job = await repo.claimImport(created.id);
    await repo.setImportStatus(created.id, 'validating');
    await repo.finishImport(created.id, {status: 'failed', issues: [{severity: 'error', code: 'X', message: 'x'}]});
    await repo.finishImport(created.id, {status: 'done', testId: randomUUID(), issues: []});

    expect(job).toEqual({
      id: created.id,
      ownerId,
      kind: 'reading',
      questionFileId: pdf.id,
      answerFileId: pdf.id,
      audioFileId: null,
    });
    const row = await repo.findImport(ownerId, created.id);
    expect(row).toMatchObject({status: 'failed', testId: null, errors: [{code: 'X'}]});
    expect(row?.finishedAt).toBeInstanceOf(Date);
    expect(await repo.claimImport(created.id)).toBeNull();
  });

  it('claims again an import left in parsing', async () => {
    const pdf = await repo.createFile(ownerId, newFile());
    const created = await repo.createImport(ownerId, {kind: 'reading', pdf: {fileId: pdf.id}, audioFileId: null});
    await db.testImport.update({where: {id: created.id}, data: {status: 'parsing'}});

    expect((await repo.claimImport(created.id))?.id).toBe(created.id);
  });

  it('deletes only old files that nothing refers to', async () => {
    const longAgo = new Date('2000-01-01T00:00:00.000Z');
    const free = await repo.createFile(ownerId, newFile());
    const used = await repo.createFile(ownerId, newFile());
    const recent = await repo.createFile(ownerId, newFile());
    await db.testImport.create({data: {ownerId, kind: 'reading', questionFileId: used.id, answerFileId: used.id}});
    await db.storedFile.updateMany({where: {id: {in: [free.id, used.id]}}, data: {createdAt: longAgo}});

    const keys = await repo.deleteOrphanFiles(new Date('2000-01-02T00:00:00.000Z'), 100);

    expect(keys).toEqual([free.storageKey]);
    expect(await repo.findFile(ownerId, free.id)).toBeNull();
    expect(await repo.findFile(ownerId, used.id)).not.toBeNull();
    expect(await repo.findFile(ownerId, recent.id)).not.toBeNull();
  });
});
