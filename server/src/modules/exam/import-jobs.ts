import {IMPORT_FILE_TTL_HOURS} from '@linmaster/shared';

import {AppError} from '../../core/app-error';
import type {Storage} from '../../core/storage';
import type {ImportJob, ImportOutcome, ImportRepository} from './imports.repository';

/**
 * Reads the files of an import into a test (PLAN C4 steps 3–4). Calls `validating()` when the AI part is done.
 * Throwing fails the import with the error message.
 */
export type ImportProcessor = (job: ImportJob, progress: {validating(): Promise<void>}) => Promise<ImportOutcome>;

/** Default until P3-06 plugs in parsing, validation and saving the test: the import fails with a clear issue. */
export const pendingImportProcessor: ImportProcessor = async () => ({
  status: 'failed',
  issues: [
    {
      severity: 'error',
      code: 'IMPORT_NOT_AVAILABLE',
      message: 'Creating a test from files is not available yet.',
    },
  ],
});

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const CLEANUP_BATCH = 100;

export interface ImportJobsDeps {
  repository: ImportRepository;
  storage: Storage;
  process: ImportProcessor;
  now?: () => Date;
}

/**
 * Background work of test imports without a long-running worker, so it survives Render putting the server to
 * sleep (shortcut: one server instance, as on Render free):
 * - A job starts right after `POST /tests/imports`. An unfinished import that no job of this process runs (the
 *   server restarted or slept) starts again when the client polls `GET /tests/imports/:id`.
 * - Orphan files (no import or test uses them, older than 24 hours) are deleted on uploads, at most once an hour.
 */
export function createImportJobs({repository, storage, process, now = () => new Date()}: ImportJobsDeps) {
  const running = new Map<string, Promise<void>>();
  let lastCleanup: number | null = null;
  let cleanup: Promise<void> | null = null;

  async function run(importId: string): Promise<void> {
    const job = await repository.claimImport(importId);
    if (!job) return;
    let outcome: ImportOutcome;
    try {
      outcome = await process(job, {validating: () => repository.setImportStatus(importId, 'validating')});
    } catch (error) {
      if (!(error instanceof AppError)) console.error(`Test import ${importId} failed:`, error);
      const message = error instanceof AppError ? error.message : 'The files could not be read into a test.';
      outcome = {status: 'failed', issues: [{severity: 'error', code: 'IMPORT_JOB_FAILED', message}]};
    }
    await repository.finishImport(importId, outcome);
  }

  async function deleteOrphans(): Promise<void> {
    const createdBefore = new Date(now().getTime() - IMPORT_FILE_TTL_HOURS * 60 * 60 * 1000);
    const keys = await repository.deleteOrphanFiles(createdBefore, CLEANUP_BATCH);
    await Promise.all(keys.map(key => storage.delete(key).catch(() => undefined)));
  }

  return {
    /** Starts the job of the import unless this process already runs it. */
    start(importId: string): void {
      if (running.has(importId)) return;
      const job = run(importId)
        .catch(error => console.error(`Test import ${importId} could not be processed:`, error))
        .finally(() => running.delete(importId));
      running.set(importId, job);
    },

    isRunning(importId: string): boolean {
      return running.has(importId);
    },

    /** Deletes orphan files when the last run is more than an hour ago. Never throws. */
    cleanupOrphans(): void {
      const time = now().getTime();
      if (cleanup || (lastCleanup !== null && time - lastCleanup < CLEANUP_INTERVAL_MS)) return;
      lastCleanup = time;
      cleanup = deleteOrphans()
        .catch(error => console.error('Orphan import files could not be deleted:', error))
        .finally(() => {
          cleanup = null;
        });
    },

    /** Resolves when every started job and cleanup has ended (tests, graceful shutdown). */
    async idle(): Promise<void> {
      while (running.size > 0 || cleanup) await Promise.all([...running.values(), cleanup]);
    },
  };
}

export type ImportJobs = ReturnType<typeof createImportJobs>;
