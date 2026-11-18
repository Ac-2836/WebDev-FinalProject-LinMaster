import type {
  ImportFileRecord,
  ImportRecord,
  ImportRepository,
  NewTest,
} from '../../src/modules/exam/imports.repository';

type FakeImport = ImportRecord & {questionFileId: string; answerFileId: string; audioFileId: string | null};

const UNFINISHED = new Set(['queued', 'parsing', 'validating']);

/**
 * In-memory `ImportRepository` for API tests. `inUse` marks files that a test or an import outside it uses.
 * New files get `fileCreatedAt` as their creation time.
 */
export function makeImportRepository() {
  const files = new Map<string, ImportFileRecord>();
  const imports = new Map<string, FakeImport>();
  const inUse = new Set<string>();
  const savedTests = new Map<string, NewTest & {ownerId: string}>();
  const clock = {fileCreatedAt: new Date('2026-11-13T03:00:00.000Z')};
  let next = 0;
  const nextId = () => {
    next += 1;
    return `0192f7e0-0bcd-7000-8000-${String(100 + next).padStart(12, '0')}`;
  };
  const usedByImport = (fileId: string) =>
    [...imports.values()].some(row => row.questionFileId === fileId || row.audioFileId === fileId);
  const isUsed = (fileId: string) => inUse.has(fileId) || usedByImport(fileId);
  const unfinished = (importId: string) => {
    const row = imports.get(importId);
    return row && UNFINISHED.has(row.status) ? row : undefined;
  };

  const repository: ImportRepository = {
    async createFile(ownerId, file) {
      const record = {id: nextId(), ownerId, ...file, pageText: file.pageText ?? null, createdAt: clock.fileCreatedAt};
      files.set(record.id, record);
      return record;
    },
    async setFileText(ownerId, fileId, pageText) {
      const file = files.get(fileId);
      if (!file || file.ownerId !== ownerId) return false;
      files.set(fileId, {...file, pageText});
      return true;
    },
    async findFile(ownerId, fileId) {
      const file = files.get(fileId);
      return file && file.ownerId === ownerId ? file : null;
    },
    async deleteFile(ownerId, fileId) {
      const file = files.get(fileId);
      if (!file || file.ownerId !== ownerId) return 'missing';
      if (isUsed(fileId)) return 'in_use';
      files.delete(fileId);
      return 'deleted';
    },
    async findFiles(ownerId, fileIds) {
      return fileIds.flatMap(id => {
        const file = files.get(id);
        return file && file.ownerId === ownerId ? [{...file, inUse: isUsed(id)}] : [];
      });
    },
    async createImport(ownerId, {kind, pdf, audioFileId}) {
      const questionFileId = 'fileId' in pdf ? pdf.fileId : (await repository.createFile(ownerId, pdf.merged)).id;
      const record: FakeImport = {
        id: nextId(),
        ownerId,
        kind,
        status: 'queued',
        errors: null,
        testId: null,
        createdAt: new Date('2026-11-13T03:05:00.000Z'),
        finishedAt: null,
        questionFileId,
        answerFileId: questionFileId,
        audioFileId,
      };
      imports.set(record.id, record);
      return {...record};
    },
    async findImport(ownerId, importId) {
      const record = imports.get(importId);
      return record && record.ownerId === ownerId ? {...record} : null;
    },
    async claimImport(importId) {
      const row = unfinished(importId);
      if (!row) return null;
      row.status = 'parsing';
      const {id, ownerId, kind, questionFileId, answerFileId, audioFileId} = row;
      return {id, ownerId, kind, questionFileId, answerFileId, audioFileId};
    },
    async setImportStatus(importId, status) {
      const row = unfinished(importId);
      if (row) row.status = status;
    },
    async finishImport(importId, outcome) {
      const row = unfinished(importId);
      if (!row) return;
      row.status = outcome.status;
      row.errors = outcome.issues;
      row.testId = outcome.status === 'done' ? outcome.testId : null;
      row.finishedAt = new Date('2026-11-13T03:06:00.000Z');
    },
    async deleteOrphanFiles(createdBefore, limit) {
      const orphans = [...files.values()]
        .filter(file => file.createdAt < createdBefore && !isUsed(file.id))
        .slice(0, limit);
      for (const file of orphans) files.delete(file.id);
      return orphans.map(file => file.storageKey);
    },
    async saveTest(ownerId, data) {
      const id = nextId();
      savedTests.set(id, {ownerId, ...data});
      return id;
    },
  };
  return {repository, files, imports, inUse, clock, savedTests};
}
