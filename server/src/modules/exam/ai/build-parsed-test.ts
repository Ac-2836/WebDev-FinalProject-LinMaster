import {normalizeJudgement} from '@linmaster/shared';
import type {
  GroupContentBlock,
  GroupShared,
  ParseAnswersOutput,
  ParsedAnswer,
  ParsedGroup,
  ParsedTest,
  ParseTestOutput,
  QuestionKind,
  Skill,
  TestKind,
} from '@linmaster/shared';

type OutlineGroup = ParseTestOutput['sections'][number]['passages'][number]['groups'][number];

const SKILL_ORDER: Readonly<Record<Skill, number>> = {listening: 0, reading: 1};

/**
 * Turns one printed answer into the `Question.answer` shape of its kind. The result is not validated here:
 * the import validator (P3-06) checks it with `parseAnswer` and reports invalid answers per question.
 * `groupAnswers` are the printed answers of the whole group, needed for "choose TWO letters" groups.
 */
export function toQuestionAnswer(
  kind: QuestionKind,
  entry: ParsedAnswer,
  groupAnswers: readonly ParsedAnswer[],
): object {
  const explanation = entry.explanation?.trim() ? {explanation: entry.explanation.trim()} : {};
  const raw = entry.answer.trim();
  switch (kind) {
    case 'tfng':
    case 'ynng':
      return {value: raw, ...explanation};
    case 'single_choice':
    case 'matching':
      // "B", "iii", "C (paragraph C)": the key is the first token.
      return {accepted: [raw.split(/[\s,;]+/u)[0]], ...explanation};
    case 'multi_choice': {
      const letters = groupAnswers.flatMap(answer => answer.answer.replace(/\(.*?\)/gu, '').match(/\b[A-Z]\b/gu) ?? []);
      return {choices: [...new Set(letters)], ...explanation};
    }
    default:
      // "19 OR nineteen", "cloud / clouds"; optional words in brackets stay, the grader expands them.
      return {
        accepted: raw
          .split(/\s+(?:\/|OR)\s+/u)
          .map(answer => answer.trim())
          .filter(Boolean),
        ...explanation,
      };
  }
}

function toShared(group: OutlineGroup): GroupShared | null {
  const shared: GroupShared = {};
  if (group.optionsTitle?.trim()) shared.optionsTitle = group.optionsTitle.trim();
  if (group.options?.length) shared.options = group.options;
  // Drops empty blocks the model may return.
  const content = (group.content ?? []).flatMap((block): GroupContentBlock[] => {
    if (block.type === 'table') return block.rows?.length ? [{type: 'table', rows: block.rows}] : [];
    return block.text?.trim() ? [{type: 'text', text: block.text}] : [];
  });
  if (content.length) shared.content = content;
  return Object.keys(shared).length ? shared : null;
}

/**
 * The model sometimes swaps TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN; the printed answers decide.
 * Only YES/NO or TRUE/FALSE answers count, since NOT GIVEN belongs to both.
 */
function judgementKind(kind: QuestionKind, groupAnswers: readonly ParsedAnswer[]): QuestionKind {
  if (kind !== 'tfng' && kind !== 'ynng') return kind;
  const values = groupAnswers.map(entry => normalizeJudgement(entry.answer));
  if (values.some(value => value === 'YES' || value === 'NO')) return 'ynng';
  if (values.some(value => value === 'TRUE' || value === 'FALSE')) return 'tfng';
  return kind;
}

/**
 * Joins the parse-test and parse-answers outputs into one structured test (Listening before Reading).
 * A question without a printed answer gets `answer: null`, which the import validator reports as missing.
 */
export function buildParsedTest(outline: ParseTestOutput, answerKey: ParseAnswersOutput, kind: TestKind): ParsedTest {
  const answers = new Map(answerKey.answers.map(entry => [`${entry.skill}:${entry.number}`, entry]));
  const sections = [...outline.sections].sort((a, b) => SKILL_ORDER[a.skill] - SKILL_ORDER[b.skill]);

  return {
    title: outline.title,
    kind,
    source: null,
    sections: sections.map(section => ({
      skill: section.skill,
      passages: section.passages.map(passage => ({
        title: passage.title,
        paragraphs: passage.paragraphs?.length
          ? passage.paragraphs.map(({label, text}) => (label?.trim() ? {label: label.trim(), text} : {text}))
          : null,
        // Listening part starts come from the audio (P3-18); unknown here.
        audioStartSec: null,
        groups: passage.groups.map((group): ParsedGroup => {
          const groupAnswers = group.questions.flatMap(q => answers.get(`${section.skill}:${q.number}`) ?? []);
          const kind = judgementKind(group.kind, groupAnswers);
          return {
            kind,
            fromNo: group.fromNo,
            toNo: group.toNo,
            instructions: group.instructions,
            wordLimit: group.wordLimit,
            shared: toShared(group),
            questions: group.questions.map(question => {
              const entry = answers.get(`${section.skill}:${question.number}`);
              return {
                number: question.number,
                prompt: question.prompt,
                options: question.options?.length ? question.options : null,
                answer: entry ? toQuestionAnswer(kind, entry, groupAnswers) : null,
              };
            }),
          };
        }),
      })),
    })),
  };
}
