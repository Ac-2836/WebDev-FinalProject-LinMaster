import type {Attempt, AttemptState, CandidateSection, GivenAnswer} from '@linmaster/shared';

import type {Answers, Highlight} from './reading/reading-logic';
import type {RoomPart} from './room-logic';

/** The section running now; the first one when the attempt is over (nothing more to answer then). */
export const currentSectionOf = (attempt: Attempt): CandidateSection | undefined =>
  attempt.test.sections.find(s => s.id === attempt.currentSectionId) ?? attempt.test.sections[0];

/** One Part per passage, with its question numbers. */
export const sectionParts = (section: CandidateSection): RoomPart[] =>
  section.passages.map(p => ({
    id: p.id,
    title: `Part ${p.position}`,
    questions: p.groups.flatMap(g => g.questions.map(q => q.number)),
  }));

/**
 * Question number ↔ id inside one section. The room shows numbers, the saved state uses ids, because numbers
 * repeat across the sections of a Full test.
 */
export function questionIndex(section: CandidateSection) {
  const idOf = new Map<number, string>();
  const numberOf = new Map<string, number>();
  for (const p of section.passages)
    for (const g of p.groups)
      for (const q of g.questions) {
        idOf.set(q.number, q.id);
        numberOf.set(q.id, q.number);
      }
  return {idOf, numberOf};
}

/** Question numbers of this section whose saved answer is not empty. */
export function answeredNumbers(state: AttemptState, numberOf: ReadonlyMap<string, number>) {
  const out = new Set<number>();
  for (const [id, given] of Object.entries(state.answers)) {
    const n = numberOf.get(id);
    if (n !== undefined && typeof given === 'string' && given.trim()) out.add(n);
  }
  return out;
}

export function flaggedNumbers(state: AttemptState, numberOf: ReadonlyMap<string, number>) {
  return new Set(state.flags.flatMap(id => numberOf.get(id) ?? []));
}

/** Marks or unmarks a question for review. */
export const toggleFlag = (state: AttemptState, questionId: string): AttemptState => ({
  ...state,
  flags: state.flags.includes(questionId) ? state.flags.filter(f => f !== questionId) : [...state.flags, questionId],
});

/** Where to reopen the room: the saved position when it is in this section, else its first question. */
export function startQuestion(state: AttemptState, section: CandidateSection, parts: RoomPart[]) {
  const {numberOf} = questionIndex(section);
  const saved = state.position?.sectionId === section.id && state.position.questionId;
  return (saved && numberOf.get(saved)) || parts[0]?.questions[0] || 1;
}

/** Saved answers (by question id) as the question views read them (by number). */
export function answersByNumber(state: AttemptState, numberOf: ReadonlyMap<string, number>): Answers {
  const out: Record<number, GivenAnswer> = {};
  for (const [id, given] of Object.entries(state.answers)) {
    const n = numberOf.get(id);
    if (n !== undefined) out[n] = given;
  }
  return out;
}

/** Writes answers given by number; an empty answer is removed. */
export function setAnswers(
  state: AttemptState,
  patch: Record<number, string | null>,
  idOf: ReadonlyMap<number, string>,
): AttemptState {
  const answers = {...state.answers};
  for (const [n, given] of Object.entries(patch)) {
    const id = idOf.get(Number(n));
    if (!id) continue;
    if (given === null) delete answers[id];
    else answers[id] = given;
  }
  return {...state, answers};
}

const sameRange = (a: {paragraph: number; start: number; end: number}, b: typeof a) =>
  a.paragraph === b.paragraph && a.start === b.start && a.end === b.end;

/** Highlights of one passage, with the note saved on the same range. */
export const passageMarks = (state: AttemptState, passageId: string): Highlight[] =>
  state.highlights
    .filter(h => h.passageId === passageId)
    .map(({paragraph, start, end}) => {
      const note = state.notes.find(n => n.passageId === passageId && sameRange(n, {paragraph, start, end}));
      return note ? {paragraph, start, end, note: note.text} : {paragraph, start, end};
    });

/** Replaces the highlights and notes of one passage, keeping those of the other passages. */
export function setPassageMarks(state: AttemptState, passageId: string, marks: readonly Highlight[]): AttemptState {
  return {
    ...state,
    highlights: [
      ...state.highlights.filter(h => h.passageId !== passageId),
      ...marks.map(({paragraph, start, end}) => ({passageId, paragraph, start, end})),
    ],
    notes: [
      ...state.notes.filter(n => n.passageId !== passageId),
      ...marks.flatMap(({paragraph, start, end, note}) =>
        note ? [{passageId, paragraph, start, end, text: note}] : [],
      ),
    ],
  };
}
