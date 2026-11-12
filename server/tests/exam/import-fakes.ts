import type {ImportFileRecord, ImportRecord, ImportRepository} from '../../src/modules/exam/imports.repository';

/** In-memory `ImportRepository` for API tests. `inUse` marks files that a test or an import outside it uses. */
export function makeImportRepository() {
  const files = new Map<string, ImportFileRecord>();
  const imports = new Map<string, ImportRecord & {questionFileId: string; audioFileId: string | null}>();
  const inUse = new Set<string>();
  let next = 0;
  const nextId = () => {
    next += 1;
    return `0192f7e0-0bcd-7000-8000-${String(100 + next).padStart(12, '0')}`;
  };
  const usedByImport = (fileId: string) =>
    [...imports.values()].some(row => row.questionFileId === fileId || row.audioFileId === fileId);
  const isUsed = (fileId: string) => inUse.has(fileId) || usedByImport(fileId);

  const repository: ImportRepository = {
    async createFile(ownerId, file) {
      const record = {id: nextId(), ownerId, ...file, createdAt: new Date('2026-11-13T03:00:00.000Z')};
      files.set(record.id, record);
      return record;
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
      const record = {
        id: nextId(),
        ownerId,
        kind,
        status: 'queued' as const,
        errors: null,
        testId: null,
        createdAt: new Date('2026-11-13T03:05:00.000Z'),
        finishedAt: null,
        questionFileId,
        audioFileId,
      };
      imports.set(record.id, record);
      return record;
    },
    async findImport(ownerId, importId) {
      const record = imports.get(importId);
      return record && record.ownerId === ownerId ? record : null;
    },
  };
  return {repository, files, imports, inUse};
}
