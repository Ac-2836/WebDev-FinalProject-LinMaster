import type {AttemptState} from '@linmaster/shared';

import type {TestContentRow} from './tests.repository';

/**
 * The saved state without what does not belong to the test: answers and flags of other questions, highlights and
 * notes of other passages, and a position in another section or on another question. The shape is checked by the
 * schema; this checks the ids, so a client cannot store arbitrary keys in `Attempt.state`.
 */
export function stateOfTest(state: AttemptState, content: TestContentRow['content']): AttemptState {
  const sections = new Set(content.map(section => section.id));
  const passages = new Set(content.flatMap(section => section.passages.map(passage => passage.id)));
  const questions = new Set(
    content.flatMap(section =>
      section.passages.flatMap(passage => passage.groups.flatMap(group => group.questions.map(({id}) => id))),
    ),
  );
  const {position} = state;
  return {
    answers: Object.fromEntries(Object.entries(state.answers).filter(([questionId]) => questions.has(questionId))),
    highlights: state.highlights.filter(range => passages.has(range.passageId)),
    notes: state.notes.filter(note => passages.has(note.passageId)),
    flags: state.flags.filter(questionId => questions.has(questionId)),
    position:
      position && sections.has(position.sectionId)
        ? {
            sectionId: position.sectionId,
            questionId: position.questionId && questions.has(position.questionId) ? position.questionId : null,
          }
        : null,
  };
}
