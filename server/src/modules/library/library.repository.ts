import type {LibraryType} from '@linmaster/shared';

import {getDb} from '../../core/db';

const TARGET = {set: 'flashcard_set', test: 'test'} as const;

/** `Report` is the only table of library (data dictionary § library). */
export interface ReportRepository {
  hasReported(reporterId: string, targetType: LibraryType, targetId: string): Promise<boolean>;
}

export const prismaReportRepository: ReportRepository = {
  async hasReported(reporterId, targetType, targetId) {
    return (await getDb().report.count({where: {reporterId, targetType: TARGET[targetType], targetId}})) > 0;
  },
};
