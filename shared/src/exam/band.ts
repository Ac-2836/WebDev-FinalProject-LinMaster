import type {Certification, Skill} from './certifications';

/** Lowest number of correct answers that earns `band`. Steps are sorted from the highest band down. */
export interface BandStep {
  minCorrect: number;
  band: number;
}

// Raw score → band, IELTS Listening and Academic Reading (40 questions each). Below band 4 the official
// tables stop, so the lower steps follow the usual practice-test conversion.
const LOW_BANDS: BandStep[] = [
  {minCorrect: 8, band: 3.5},
  {minCorrect: 6, band: 3},
  {minCorrect: 4, band: 2.5},
  {minCorrect: 2, band: 2},
  {minCorrect: 1, band: 1},
  {minCorrect: 0, band: 0},
];

export const IELTS_LISTENING_BANDS: readonly BandStep[] = [
  {minCorrect: 39, band: 9},
  {minCorrect: 37, band: 8.5},
  {minCorrect: 35, band: 8},
  {minCorrect: 32, band: 7.5},
  {minCorrect: 30, band: 7},
  {minCorrect: 26, band: 6.5},
  {minCorrect: 23, band: 6},
  {minCorrect: 18, band: 5.5},
  {minCorrect: 16, band: 5},
  {minCorrect: 13, band: 4.5},
  {minCorrect: 10, band: 4},
  ...LOW_BANDS,
];

export const IELTS_ACADEMIC_READING_BANDS: readonly BandStep[] = [
  {minCorrect: 39, band: 9},
  {minCorrect: 37, band: 8.5},
  {minCorrect: 35, band: 8},
  {minCorrect: 33, band: 7.5},
  {minCorrect: 30, band: 7},
  {minCorrect: 27, band: 6.5},
  {minCorrect: 23, band: 6},
  {minCorrect: 19, band: 5.5},
  {minCorrect: 15, band: 5},
  {minCorrect: 13, band: 4.5},
  {minCorrect: 10, band: 4},
  ...LOW_BANDS,
];

/** Band for a raw score of one skill. Throws a RangeError for a score outside 0..questionCount. */
export function toBand(certification: Certification, skill: Skill, correct: number): number {
  const section = certification.sections[skill];
  if (!Number.isInteger(correct) || correct < 0 || correct > section.questionCount) {
    throw new RangeError(`Score ${correct} is outside 0..${section.questionCount} for ${skill}.`);
  }
  const step = section.bandTable.find(item => correct >= item.minCorrect);
  return step ? step.band : 0;
}
