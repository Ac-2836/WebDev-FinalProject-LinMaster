import {ParsedParagraphSchema} from '@linmaster/shared';
import {z} from 'zod';

import {getDb} from '../../core/db';

const ParagraphsSchema = z.array(ParsedParagraphSchema);

/** Text of a passage of a submitted attempt, or why it cannot be read. */
export type PassageText =
  | {status: 'ok'; title: string; paragraphs: {label?: string; text: string}[]}
  | {status: 'not_found' | 'forbidden' | 'not_submitted'};

/**
 * Public API of exam (PLAN C4) for vocab: the Reading passage or Listening transcript of an attempt, only for its
 * owner and only once submitted, because a Listening transcript is never shown before submitting.
 * `not_found` also covers a passage of another test and a part without text.
 */
export async function getPassageText(userId: string, attemptId: string, passageId: string): Promise<PassageText> {
  const attempt = await getDb().attempt.findUnique({
    where: {id: attemptId},
    select: {userId: true, status: true, testId: true, test: {select: {title: true}}},
  });
  if (!attempt) return {status: 'not_found'};
  if (attempt.userId !== userId) return {status: 'forbidden'};
  if (attempt.status !== 'submitted') return {status: 'not_submitted'};

  const passage = await getDb().passage.findFirst({
    where: {id: passageId, section: {testId: attempt.testId}},
    select: {title: true, paragraphs: true},
  });
  const paragraphs = ParagraphsSchema.safeParse(passage?.paragraphs);
  if (!passage || !paragraphs.success || paragraphs.data.length === 0) return {status: 'not_found'};
  return {
    status: 'ok',
    title: `${attempt.test.title}: ${passage.title}`.slice(0, 200),
    paragraphs: paragraphs.data.map(({label, text}) => (label === undefined ? {text} : {label, text})),
  };
}
