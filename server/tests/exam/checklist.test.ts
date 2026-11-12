import {describe, expect, it} from 'vitest';
import {
  buildChecklist,
  type ChecklistFile,
  type ChecklistItem,
  ChecklistSchema,
  type ImportSlot,
  type PageLabel,
  type PageLabels,
  type Skill,
} from '@linmaster/shared';

const id = (n: number) => `0192f7e0-0bcd-7000-8000-${String(n).padStart(12, '0')}`;

function page(labels: PageLabel[], skill: Skill | null, range: [number, number] | null = null, number = 1): PageLabels {
  return {page: number, labels, skill, questionRange: range && {from: range[0], to: range[1]}};
}

const pdf = (n: number, pages: PageLabels[], ...slots: ImportSlot[]): ChecklistFile => ({
  fileId: id(n),
  type: 'pdf',
  pages,
  slots: slots.length > 0 ? slots : undefined,
});
const audio = (n: number, ...slots: ImportSlot[]): ChecklistFile => ({
  fileId: id(n),
  type: 'audio',
  pages: null,
  slots: slots.length > 0 ? slots : undefined,
});

/** A complete Academic Reading paper with the answer key at the end. */
const readingPaper = (n = 1) =>
  pdf(n, [
    page(['passage', 'questions'], 'reading', [1, 13]),
    page(['passage', 'questions'], 'reading', [14, 26]),
    page(['passage', 'questions'], 'reading', [27, 40]),
    page(['answers'], 'reading', [1, 40]),
  ]);

/** A Listening question paper with answers, transcript and explanations. */
const listeningPaper = (n = 2) =>
  pdf(n, [
    page(['instructions', 'questions'], 'listening', [1, 20]),
    page(['questions'], 'listening', [21, 40]),
    page(['answers', 'explanations'], 'listening', [1, 40]),
    page(['transcript'], 'listening'),
  ]);

const row = (items: ChecklistItem[], part: ChecklistItem['part'], skill: Skill) =>
  items.find(item => item.part === part && item.skill === skill);

describe('buildChecklist', () => {
  it('marks a complete Reading paper as complete and detects the kind', () => {
    const checklist = buildChecklist({files: [readingPaper()]});

    expect(ChecklistSchema.parse(checklist)).toEqual(checklist);
    expect(checklist).toMatchObject({kind: 'reading', detectedKind: 'reading', complete: true, unusedFileIds: []});
    expect(checklist.items.map(item => [item.part, item.status])).toEqual([
      ['questions', 'complete'],
      ['answers', 'complete'],
      ['explanations', 'missing'],
      ['passages', 'complete'],
    ]);
    expect(row(checklist.items, 'explanations', 'reading')).toMatchObject({
      required: false,
      missing: [{from: 1, to: 40}],
    });
  });

  it('reports the exact answer numbers still missing', () => {
    const file = pdf(1, [page(['passage', 'questions'], 'reading', [1, 40]), page(['answers'], 'reading', [1, 25])]);
    const checklist = buildChecklist({files: [file]});

    expect(checklist.complete).toBe(false);
    expect(row(checklist.items, 'answers', 'reading')).toEqual({
      part: 'answers',
      skill: 'reading',
      required: true,
      status: 'partial',
      missing: [{from: 26, to: 40}],
    });
  });

  it('joins answers spread over several files and reports gaps between them', () => {
    const questions = pdf(1, [page(['passage', 'questions'], 'reading', [1, 40])]);
    const answers = pdf(2, [page(['answers'], 'reading', [1, 10]), page(['answers'], 'reading', [21, 40], 2)]);

    const checklist = buildChecklist({files: [questions, answers]});

    expect(row(checklist.items, 'answers', 'reading')?.missing).toEqual([{from: 11, to: 20}]);
  });

  it('requires the audio for Listening but not the transcript or explanations', () => {
    const withoutAudio = buildChecklist({files: [listeningPaper()]});
    const withAudio = buildChecklist({files: [listeningPaper(), audio(3)]});

    expect(withoutAudio).toMatchObject({kind: 'listening', complete: false});
    expect(row(withoutAudio.items, 'audio', 'listening')).toMatchObject({required: true, status: 'missing'});
    expect(withAudio.complete).toBe(true);
    expect(row(withAudio.items, 'transcript', 'listening')).toMatchObject({required: false, status: 'complete'});
    expect(row(withAudio.items, 'passages', 'listening')).toBeUndefined();
  });

  it('needs both skills for a full test', () => {
    const both = buildChecklist({files: [listeningPaper(), readingPaper(), audio(3)]});
    const readingOnly = buildChecklist({kind: 'full', files: [readingPaper()]});

    expect(both).toMatchObject({kind: 'full', detectedKind: 'full', complete: true});
    expect(both.items.map(item => item.skill)).toEqual([
      'listening',
      'listening',
      'listening',
      'listening',
      'listening',
      'reading',
      'reading',
      'reading',
      'reading',
    ]);
    expect(readingOnly).toMatchObject({kind: 'full', detectedKind: 'reading', complete: false});
    expect(row(readingOnly.items, 'questions', 'listening')?.missing).toEqual([{from: 1, to: 40}]);
  });

  it('uses the kind picked by the learner over the detected one', () => {
    const checklist = buildChecklist({kind: 'reading', files: [readingPaper(), audio(3)]});

    expect(checklist).toMatchObject({kind: 'reading', detectedKind: 'full', complete: true});
    expect(checklist.unusedFileIds).toEqual([id(3)]);
  });

  it('gives a page without a skill to the only skill of a one-skill test', () => {
    const file = pdf(1, [page(['passage', 'questions'], 'reading', [1, 40]), page(['answers'], null, [1, 40])]);

    expect(buildChecklist({files: [file]}).complete).toBe(true);
  });

  it('counts answer pages without a skill for both skills of a full test', () => {
    const file = pdf(1, [
      page(['questions'], 'listening', [1, 40]),
      page(['passage', 'questions'], 'reading', [1, 40], 2),
      page(['answers', 'explanations'], null, [1, 40], 3),
    ]);
    const checklist = buildChecklist({files: [file, audio(3)]});

    expect(checklist).toMatchObject({kind: 'full', complete: true});
    for (const skill of ['listening', 'reading'] as const) {
      expect(row(checklist.items, 'answers', skill)?.status).toBe('complete');
      expect(row(checklist.items, 'explanations', skill)?.status).toBe('complete');
    }
  });

  it('does not give question or passage pages without a skill to a skill of a full test', () => {
    const file = pdf(1, [page(['passage', 'questions'], null, [1, 40]), page(['answers'], null, [1, 40], 2)]);
    const checklist = buildChecklist({kind: 'full', files: [file, audio(3)]});

    expect(checklist.complete).toBe(false);
    expect(row(checklist.items, 'questions', 'reading')?.status).toBe('missing');
    expect(row(checklist.items, 'passages', 'reading')?.status).toBe('missing');
  });

  it('accepts labelled pages without question numbers', () => {
    const file = pdf(1, [page(['passage', 'questions'], 'reading'), page(['answers'], 'reading')]);

    expect(buildChecklist({files: [file]}).complete).toBe(true);
  });

  it('marks files that are not part of a test as unused and ignores them', () => {
    const cover = pdf(9, [page(['other'], null), page(['other'], null, null, 2)]);
    const checklist = buildChecklist({files: [readingPaper(), cover]});

    expect(checklist.unusedFileIds).toEqual([id(9)]);
    expect(checklist.complete).toBe(true);
  });

  it('cannot decide anything without files or a known kind', () => {
    expect(buildChecklist({files: []})).toEqual({
      kind: null,
      detectedKind: null,
      items: [],
      unusedFileIds: [],
      complete: false,
    });
    expect(buildChecklist({files: [pdf(1, [page(['other'], null)])]}).complete).toBe(false);
    expect(buildChecklist({kind: 'reading', files: []}).complete).toBe(false);
  });

  describe('"Theo mẫu" tab', () => {
    it('counts a file in a box for that whole part, without page labels', () => {
      const files = [pdf(1, [], 'test'), pdf(2, [], 'answers'), audio(3, 'audio')];

      expect(buildChecklist({kind: 'listening', files}).complete).toBe(true);
      expect(buildChecklist({kind: 'full', files}).complete).toBe(true);
    });

    it('lets one file fill several boxes', () => {
      const paperWithKey = pdf(1, [], 'test', 'answers');

      expect(buildChecklist({kind: 'listening', files: [paperWithKey, audio(3, 'audio')]}).complete).toBe(true);
      expect(buildChecklist({kind: 'reading', files: [paperWithKey]}).complete).toBe(true);
      expect(buildChecklist({kind: 'reading', files: [pdf(1, [], 'test', 'explanations')]}).complete).toBe(false);
    });

    it('reports an empty required box', () => {
      const checklist = buildChecklist({kind: 'reading', files: [pdf(1, [], 'test')]});

      expect(checklist.complete).toBe(false);
      expect(row(checklist.items, 'answers', 'reading')?.status).toBe('missing');
    });

    it('detects Listening from the audio box', () => {
      expect(buildChecklist({files: [audio(3, 'audio')]}).detectedKind).toBe('listening');
    });
  });
});
