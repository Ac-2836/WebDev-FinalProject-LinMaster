import type {ApiModule} from '../../core/module-registry';
import {getTargetBand} from '../auth';
import {getExamStats, getTestCommunityStats} from '../exam';
import {getSetCommunityStats, getStudyStats} from '../flashcard';
import {getVocabStats} from '../vocab';
import {createStatsRouter} from './stats.routes';
import {createStatsService, type StatsSources} from './stats.service';
import './stats.openapi';

const sources: StatsSources = {
  vocab: getVocabStats,
  study: getStudyStats,
  exam: getExamStats,
  targetBand: getTargetBand,
  sets: getSetCommunityStats,
  tests: getTestCommunityStats,
};

/**
 * Stats module (PLAN C6): the personal dashboard. It owns no table; every number comes from the public API of
 * auth, vocab, flashcard and exam.
 */
export function createStatsModule(jwtSecret: string, deps: StatsSources = sources, now?: () => Date): ApiModule {
  return {name: 'stats', basePath: '/api/v1', router: createStatsRouter(createStatsService(deps, now), jwtSecret)};
}

export {createStatsService, type StatsSources} from './stats.service';
