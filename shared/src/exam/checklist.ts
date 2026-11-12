import {z} from 'zod';

import {
  type Certification,
  CERTIFICATIONS,
  sectionsOf,
  type Skill,
  SkillSchema,
  type TestKind,
  TestKindSchema,
} from './certifications';
import type {ImportFileType, ImportSlot} from './imports';
import type {PageLabel, PageLabels} from './page-labels';

/** Parts of a test upload shown in the "Độ đầy đủ" table (PLAN C4 step 1, Phần F). */
export const ChecklistPartSchema = z.enum(['questions', 'passages', 'answers', 'audio', 'explanations', 'transcript']);
export const ChecklistStatusSchema = z.enum(['complete', 'partial', 'missing']);

export const QuestionRangeSchema = z.object({from: z.number().int().min(1), to: z.number().int().min(1)});

export const ChecklistItemSchema = z.object({
  part: ChecklistPartSchema,
  /** Skill the row is about; `audio` and `transcript` rows are always Listening. */
  skill: SkillSchema,
  /** Required parts block the import; explanations and transcripts are optional (warnings only). */
  required: z.boolean(),
  status: ChecklistStatusSchema,
  /** Question numbers not found yet, e.g. answers missing for 26–40. Empty for parts without numbers. */
  missing: z.array(QuestionRangeSchema),
});

export const ChecklistSchema = z.object({
  /** Kind the table was built for: the one the learner picked, else `detectedKind`. */
  kind: TestKindSchema.nullable(),
  /** Kind inferred from the skills found in the files, which the learner can change (Phần F). */
  detectedKind: TestKindSchema.nullable(),
  items: z.array(ChecklistItemSchema),
  /** Files that do not look like part of a test; they are ignored, not an error. */
  unusedFileIds: z.array(z.string().uuid()),
  /** True when every required row is complete; the "Tạo đề" button is enabled only then. */
  complete: z.boolean(),
});

export type ChecklistPart = z.infer<typeof ChecklistPartSchema>;
export type ChecklistStatus = z.infer<typeof ChecklistStatusSchema>;
export type QuestionRange = z.infer<typeof QuestionRangeSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type Checklist = z.infer<typeof ChecklistSchema>;

/** One uploaded file as the checklist sees it. */
export interface ChecklistFile {
  fileId: string;
  type: ImportFileType;
  /** Page labels of a PDF (`classify-pages.v1`); null for audio or when labels are not known. */
  pages: readonly PageLabels[] | null;
  /** Boxes of the "Theo mẫu" tab; a file counts for the whole part of each box it fills. */
  slots?: readonly ImportSlot[];
}

export interface ChecklistInput {
  /** Kind picked by the learner; when absent the detected kind is used. */
  kind?: TestKind | null;
  files: readonly ChecklistFile[];
  certification?: Certification;
}

/** Page label and box that provide each numbered part. */
const NUMBERED_PARTS = {
  questions: {label: 'questions', slot: 'test'},
  answers: {label: 'answers', slot: 'answers'},
  explanations: {label: 'explanations', slot: 'explanations'},
} as const satisfies Partial<Record<ChecklistPart, {label: PageLabel; slot: ImportSlot}>>;

const CONTENT_LABELS: ReadonlySet<PageLabel> = new Set([
  'passage',
  'questions',
  'answers',
  'explanations',
  'transcript',
]);

const LISTENING_SLOTS: ReadonlySet<ImportSlot> = new Set(['audio', 'transcript']);
/**
 * In a full test, `parse-answers.v1` tells which answers belong to which skill (PLAN C4 step 3), so answer and
 * explanation pages without a skill count for both skills here.
 */
const LABELS_FOR_ANY_SKILL: ReadonlySet<PageLabel> = new Set(['answers', 'explanations']);

function isUnusedPdf(file: ChecklistFile): boolean {
  return (
    file.type === 'pdf' &&
    !file.slots?.length &&
    file.pages !== null &&
    file.pages.every(page => page.labels.every(label => label === 'other'))
  );
}

function detectKind(files: readonly ChecklistFile[]): TestKind | null {
  const skills = new Set<Skill>();
  for (const file of files) {
    if (file.type === 'audio' || file.slots?.some(slot => LISTENING_SLOTS.has(slot))) skills.add('listening');
    for (const page of file.pages ?? []) {
      if (page.skill && page.labels.some(label => CONTENT_LABELS.has(label))) skills.add(page.skill);
    }
  }
  if (skills.has('listening') && skills.has('reading')) return 'full';
  if (skills.has('listening')) return 'listening';
  if (skills.has('reading')) return 'reading';
  return null;
}

/** Missing question numbers of 1..count as ranges, e.g. [{from: 26, to: 40}]. */
function missingRanges(covered: readonly boolean[], count: number): QuestionRange[] {
  const ranges: QuestionRange[] = [];
  for (let number = 1; number <= count; number++) {
    if (covered[number]) continue;
    const last = ranges.at(-1);
    if (last && last.to === number - 1) last.to = number;
    else ranges.push({from: number, to: number});
  }
  return ranges;
}

/**
 * The "Độ đầy đủ" table (PLAN C4 step 1). The client calls it after every upload and the server again on
 * `POST /tests/imports`. It is a quick check on page labels; P3-06 still validates every question.
 */
export function buildChecklist({
  kind,
  files,
  certification = CERTIFICATIONS.IELTS_ACADEMIC,
}: ChecklistInput): Checklist {
  const detectedKind = detectKind(files);
  const checkedKind = kind ?? detectedKind;
  const hasListening = checkedKind === 'listening' || checkedKind === 'full';
  const unusedFileIds = files
    .filter(file => isUnusedPdf(file) || (file.type === 'audio' && checkedKind !== null && !hasListening))
    .map(file => file.fileId);
  if (!checkedKind) return {kind: null, detectedKind, items: [], unusedFileIds, complete: false};

  const used = files.filter(file => !unusedFileIds.includes(file.fileId));
  const hasSlot = (slot: ImportSlot) => used.some(file => file.slots?.includes(slot));
  // A page without a skill (e.g. an answer key with no heading) belongs to the only skill of a one-skill test;
  // in a full test only answer and explanation pages count, for both skills.
  const ownsPage = (skill: Skill, label: PageLabel, pageSkill: Skill | null) =>
    pageSkill === skill || (pageSkill === null && (checkedKind !== 'full' || LABELS_FOR_ANY_SKILL.has(label)));
  const pagesOf = (skill: Skill, label: PageLabel) =>
    used.flatMap(file =>
      (file.pages ?? []).filter(page => page.labels.includes(label) && ownsPage(skill, label, page.skill)),
    );
  const statusOf = (found: boolean): ChecklistStatus => (found ? 'complete' : 'missing');

  const items: ChecklistItem[] = [];
  for (const section of sectionsOf(certification, checkedKind)) {
    const {skill, questionCount} = section;
    for (const [part, {label, slot}] of Object.entries(NUMBERED_PARTS)) {
      const required = part !== 'explanations';
      const pages = pagesOf(skill, label);
      const ranges = pages.flatMap(page => (page.questionRange ? [page.questionRange] : []));
      // A filled box, or labelled pages without numbers, cannot be checked per question here.
      if (hasSlot(slot) || (pages.length > 0 && ranges.length === 0)) {
        items.push({part: part as ChecklistPart, skill, required, status: 'complete', missing: []});
        continue;
      }
      const covered: boolean[] = [];
      for (const range of ranges) {
        for (let number = Math.max(1, range.from); number <= Math.min(questionCount, range.to); number++) {
          covered[number] = true;
        }
      }
      const missing = missingRanges(covered, questionCount);
      const status = missing.length === 0 ? 'complete' : covered.some(Boolean) ? 'partial' : 'missing';
      items.push({part: part as ChecklistPart, skill, required, status, missing});
    }
    if (skill === 'reading') {
      const found = hasSlot('test') || pagesOf(skill, 'passage').length > 0;
      items.push({part: 'passages', skill, required: true, status: statusOf(found), missing: []});
    } else {
      const audio = used.some(file => file.type === 'audio');
      const transcript = hasSlot('transcript') || pagesOf(skill, 'transcript').length > 0;
      items.push({part: 'audio', skill, required: true, status: statusOf(audio), missing: []});
      items.push({part: 'transcript', skill, required: false, status: statusOf(transcript), missing: []});
    }
  }

  const complete = items.every(item => !item.required || item.status === 'complete');
  return {kind: checkedKind, detectedKind, items, unusedFileIds, complete};
}
