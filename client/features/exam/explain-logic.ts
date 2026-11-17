import type {AnswerEvidence, CandidateTest, ResultTranscript, Skill} from '@linmaster/shared';

/** The answers already explained, by `skill:number`: asking the AI again for the same question costs three model calls. */
export const explainKey = (skill: Skill, number: number) => `${skill}:${number}`;

/** The question text as the learner saw it in the room, with the gap of a completion question shown as a line. */
export function findPrompt(test: CandidateTest | null, skill: Skill, number: number): string | null {
  for (const section of test?.sections ?? []) {
    if (section.skill !== skill) continue;
    for (const passage of section.passages) {
      for (const group of passage.groups) {
        const question = group.questions.find(q => q.number === number);
        if (question) return question.prompt.replaceAll('{{blank}}', '____');
      }
    }
  }
  return null;
}

export interface EvidenceContext {
  title: string;
  /** Paragraph label (A, B…) when the passage has one, else its 1-based position. */
  label: string;
  text: string;
}

/** The paragraph an evidence range points into: a Reading passage of the test or a Listening transcript. */
export function evidenceContext(
  evidence: AnswerEvidence,
  test: CandidateTest | null,
  transcripts: readonly ResultTranscript[],
): EvidenceContext | null {
  const passages = [
    ...(test?.sections.flatMap(s => s.passages) ?? []).map(p => ({id: p.id, title: p.title, paragraphs: p.paragraphs})),
    ...transcripts.map(tr => ({id: tr.passageId, title: tr.title, paragraphs: tr.paragraphs})),
  ];
  // A Listening part is in the test without text and in the transcripts with it: take the one that has paragraphs.
  const passage = passages.find(p => p.id === evidence.passageId && p.paragraphs);
  const paragraph = passage?.paragraphs?.[evidence.paragraph];
  if (!passage || !paragraph) return null;
  return {title: passage.title, label: paragraph.label ?? String(evidence.paragraph + 1), text: paragraph.text};
}

/**
 * Splits a paragraph around the evidence so it can be marked. Trusts `start`/`end` when they hold the quote, otherwise
 * looks for the quote itself; null when the quote is not in the paragraph (then only the quote is shown).
 */
export function splitEvidence(text: string, evidence: Pick<AnswerEvidence, 'start' | 'end' | 'quote'>) {
  const at =
    text.slice(evidence.start, evidence.end) === evidence.quote ? evidence.start : text.indexOf(evidence.quote);
  if (at < 0 || !evidence.quote) return null;
  return {before: text.slice(0, at), mark: evidence.quote, after: text.slice(at + evidence.quote.length)};
}
