import type {
  AttemptSummary,
  ImportFile,
  ImportSlot,
  ImportStatus,
  PageLabel,
  PageLabels,
  Skill,
  TestKind,
  TestSummary,
} from '@linmaster/shared';

/** One chip of an uploaded PDF: consecutive pages with the same main label and skill. */
export interface PageChip {
  from: number;
  to: number;
  label: PageLabel;
  skill: Skill | null;
  /** Question numbers seen on those pages. */
  range: {from: number; to: number} | null;
}

// The label a chip is named after when a page holds several (e.g. the end of a passage and the first questions).
const LABEL_ORDER: readonly PageLabel[] = [
  'questions',
  'answers',
  'explanations',
  'transcript',
  'passage',
  'instructions',
  'other',
];
const mainLabel = (page: PageLabels) => LABEL_ORDER.find(l => page.labels.includes(l)) ?? 'other';

/** Page labels of a PDF as a few chips: "p. 2–9 · Listening questions 1–40". */
export function pageChips(pages: readonly PageLabels[]): PageChip[] {
  const chips: PageChip[] = [];
  for (const page of pages) {
    const label = mainLabel(page);
    const last = chips.at(-1);
    if (last && last.label === label && last.skill === page.skill && last.to === page.page - 1) {
      last.to = page.page;
      if (page.questionRange) {
        last.range = last.range
          ? {
              from: Math.min(last.range.from, page.questionRange.from),
              to: Math.max(last.range.to, page.questionRange.to),
            }
          : {...page.questionRange};
      }
    } else {
      chips.push({
        from: page.page,
        to: page.page,
        label,
        skill: page.skill,
        range: page.questionRange ? {...page.questionRange} : null,
      });
    }
  }
  return chips;
}

const LISTENING_KINDS: ReadonlySet<TestKind> = new Set(['listening', 'full']);

/** Boxes of the "Theo mẫu" tab for a test kind, required ones first. */
export function templateSlots(kind: TestKind): {slot: ImportSlot; required: boolean}[] {
  const listening = LISTENING_KINDS.has(kind);
  return [
    {slot: 'test', required: true},
    ...(listening ? [{slot: 'audio' as const, required: true}] : []),
    {slot: 'answers', required: true},
    ...(listening ? [{slot: 'transcript' as const, required: false}] : []),
    {slot: 'explanations', required: false},
  ];
}

/** The chosen file of each box, as `POST /tests/imports` wants them: one entry per file with all its boxes. */
export function slotFiles(kind: TestKind, chosen: Partial<Record<ImportSlot, string>>) {
  const byFile = new Map<string, ImportSlot[]>();
  for (const {slot} of templateSlots(kind)) {
    const fileId = chosen[slot];
    if (fileId) byFile.set(fileId, [...(byFile.get(fileId) ?? []), slot]);
  }
  return [...byFile].map(([fileId, slots]) => ({fileId, slots}));
}

export const slotAccepts = (slot: ImportSlot): ImportFile['type'] => (slot === 'audio' ? 'audio' : 'pdf');

export const isRunning = (status: ImportStatus) => status !== 'done' && status !== 'failed';

/** What a test row says about the learner's attempts: in progress, last band, or not taken. */
export function testProgress(test: TestSummary, attempts: readonly AttemptSummary[]) {
  const mine = attempts.filter(a => a.testId === test.id);
  const inProgress = mine.find(a => a.status === 'in_progress');
  if (inProgress) return {state: 'inProgress' as const};
  const last = mine.find(a => a.status === 'submitted');
  if (last) return {state: 'done' as const, scores: last.scores};
  return {state: 'new' as const};
}
