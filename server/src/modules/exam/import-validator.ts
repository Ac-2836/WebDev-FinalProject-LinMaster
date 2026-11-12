import {
  type Certification,
  type ImportIssue,
  type ImportIssueCode,
  type ParsedTest,
  parseAnswer,
  sectionsOf,
  type Skill,
  type TestKind,
} from '@linmaster/shared';

// Checks before a parsed test is saved (PLAN C4 step 4), without AI: blocking errors fail the import, warnings
// are kept with the new test.

export interface ValidationInput {
  test: ParsedTest;
  kind: TestKind;
  certification: Certification;
  /** Audio of the import; null when none was uploaded. */
  audio: {durationSec: number | null} | null;
}

export interface ValidationResult {
  /** Errors and warnings; the import fails when one has `severity: 'error'`. */
  issues: ImportIssue[];
  /** Sections of the kind only, in exam order, with every answer in the canonical form of its kind. */
  test: ParsedTest;
}

type Issue = Omit<ImportIssue, 'code'> & {code: ImportIssueCode};
type ParsedSection = ParsedTest['sections'][number];

/** `[1, 2, 3, 7]` → `1–3, 7`. */
export function formatNumbers(numbers: readonly number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const from = sorted[index];
    while (sorted[index + 1] === sorted[index] + 1) index++;
    ranges.push(from === sorted[index] ? `${from}` : `${from}–${sorted[index]}`);
  }
  return ranges.join(', ');
}

/** Sections with the same skill are joined, as the model may split one section in two. */
function joinSections(sections: readonly ParsedSection[]): Map<Skill, ParsedSection> {
  const bySkill = new Map<Skill, ParsedSection>();
  for (const section of sections) {
    const known = bySkill.get(section.skill);
    bySkill.set(section.skill, known ? {...known, passages: [...known.passages, ...section.passages]} : section);
  }
  return bySkill;
}

function checkSection(section: ParsedSection, certification: Certification, issues: Issue[]): ParsedSection {
  const spec = certification.sections[section.skill];
  const error = (code: ImportIssueCode, message: string, questionNo?: number) =>
    issues.push({severity: 'error', section: section.skill, code, message, ...(questionNo ? {questionNo} : {})});
  const numbers = section.passages.flatMap(passage =>
    passage.groups.flatMap(group => group.questions.map(question => question.number)),
  );
  if (numbers.length !== spec.questionCount) {
    error('QUESTION_COUNT', `Found ${numbers.length} questions; ${section.skill} needs ${spec.questionCount}.`);
  }
  const seen = new Set<number>();
  for (const number of numbers) {
    if (seen.has(number)) error('QUESTION_NUMBERING', `Question ${number} appears twice.`, number);
    seen.add(number);
  }
  for (let number = 1; number <= spec.questionCount; number++) {
    if (!seen.has(number)) error('QUESTION_NUMBERING', `Question ${number} was not found.`, number);
  }

  const withoutExplanation: number[] = [];
  const passages = section.passages.map(passage => {
    if (section.skill === 'reading' && !passage.paragraphs?.length) {
      error('PASSAGE_TEXT_MISSING', `The passage "${passage.title}" has no text.`);
    }
    if (section.skill === 'listening' && !passage.paragraphs?.length) {
      issues.push({
        severity: 'warning',
        section: section.skill,
        code: 'TRANSCRIPT_MISSING',
        message: `"${passage.title}" has no transcript; it is shown after submitting when there is one.`,
      });
    }
    const groups = passage.groups.map(group => {
      if (!spec.questionKinds.includes(group.kind)) {
        error('KIND_NOT_ALLOWED', `Question kind ${group.kind} is not used in ${section.skill}.`, group.fromNo);
      }
      const questions = group.questions.map(question => {
        if (question.answer === null || question.answer === undefined) {
          error('ANSWER_MISSING', `Question ${question.number} has no answer.`, question.number);
          return question;
        }
        const parsed = parseAnswer(group.kind, question.answer);
        if (!parsed.success) {
          error('ANSWER_INVALID', `The answer of question ${question.number} does not fit its kind.`, question.number);
          return question;
        }
        if (!(parsed.data as {explanation?: string}).explanation) withoutExplanation.push(question.number);
        return {...question, answer: parsed.data};
      });
      if (group.kind === 'multi_choice') {
        const choices = parseAnswer('multi_choice', group.questions[0]?.answer);
        const letters = choices.success ? (choices.data as {choices: string[]}).choices.length : null;
        if (letters !== null && letters !== group.questions.length) {
          error(
            'MULTI_CHOICE_MISMATCH',
            `Questions ${formatNumbers(group.questions.map(question => question.number))} need ` +
              `${group.questions.length} letters; the answer has ${letters}.`,
            group.fromNo,
          );
        }
      }
      return {...group, questions};
    });
    return {...passage, groups};
  });
  if (withoutExplanation.length > 0) {
    issues.push({
      severity: 'warning',
      section: section.skill,
      code: 'EXPLANATION_MISSING',
      message: `No explanation for questions ${formatNumbers(withoutExplanation)}; AI explanations can fill in.`,
    });
  }
  return {...section, passages};
}

/** Validates a parsed test against the kind and the certification (question count, numbering, answers, audio). */
export function validateParsedTest({test, kind, certification, audio}: ValidationInput): ValidationResult {
  const issues: Issue[] = [];
  const bySkill = joinSections(test.sections);
  const specs = sectionsOf(certification, kind);
  for (const skill of bySkill.keys()) {
    if (!specs.some(spec => spec.skill === skill)) {
      issues.push({
        severity: 'warning',
        section: skill,
        code: 'SECTION_IGNORED',
        message: `The ${skill} part is not used in a ${kind} test.`,
      });
    }
  }
  const sections = specs.flatMap(spec => {
    const section = bySkill.get(spec.skill);
    if (!section) {
      issues.push({
        severity: 'error',
        section: spec.skill,
        code: 'SECTION_MISSING',
        message: `No ${spec.skill} part was found.`,
      });
      return [];
    }
    return [checkSection(section, certification, issues)];
  });
  if (specs.some(spec => spec.skill === 'listening')) {
    if (!audio) {
      issues.push({severity: 'error', section: 'listening', code: 'AUDIO_MISSING', message: 'Listening needs audio.'});
    } else if (audio.durationSec === null) {
      issues.push({
        severity: 'error',
        section: 'listening',
        code: 'AUDIO_DURATION_UNKNOWN',
        message: 'The length of the audio could not be read.',
      });
    }
  }
  return {issues, test: {...test, kind, sections}};
}
