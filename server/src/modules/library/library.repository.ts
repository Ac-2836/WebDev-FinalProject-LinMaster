import type {LibraryType, ReportReason} from '@linmaster/shared';

import {getDb} from '../../core/db';
import {Prisma} from '../../generated/prisma/client';

const TARGET = {set: 'flashcard_set', test: 'test'} as const;

export interface NewReport {
  reporterId: string;
  targetType: LibraryType;
  targetId: string;
  reason: ReportReason;
  detail: string | null;
}

/** `Report` is the only table of library (data dictionary § library). */
export interface ReportRepository {
  /** Saves the report and returns the open reports of the content; `duplicate` when the person reported it before. */
  create(report: NewReport): Promise<{status: 'ok'; openReports: number} | {status: 'duplicate'}>;
  hasReported(reporterId: string, targetType: LibraryType, targetId: string): Promise<boolean>;
  /** Closes the open reports when the owner takes hidden content back to private (st-03). */
  resolveOpen(targetType: LibraryType, targetId: string): Promise<void>;
}

export const prismaReportRepository: ReportRepository = {
  async create({targetType, ...report}) {
    const db = getDb();
    const data = {...report, targetType: TARGET[targetType]};
    try {
      await db.report.create({data});
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return {status: 'duplicate'};
      throw error;
    }
    const where = {targetType: data.targetType, targetId: data.targetId, status: 'open' as const};
    return {status: 'ok', openReports: await db.report.count({where})};
  },

  async hasReported(reporterId, targetType, targetId) {
    return (await getDb().report.count({where: {reporterId, targetType: TARGET[targetType], targetId}})) > 0;
  },

  async resolveOpen(targetType, targetId) {
    await getDb().report.updateMany({
      where: {targetType: TARGET[targetType], targetId, status: 'open'},
      data: {status: 'resolved'},
    });
  },
};
