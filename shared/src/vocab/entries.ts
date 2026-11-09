import {z} from 'zod';

export const CefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const VocabContextSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid().nullable(),
  sentence: z.string(),
  startOffset: z.number().int().nullable(),
  endOffset: z.number().int().nullable(),
  sourceUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const VocabEntrySchema = z.object({
  id: z.string().uuid(),
  headword: z.string(),
  lemma: z.string(),
  partOfSpeech: z.string(),
  ipa: z.string().nullable(),
  meaningVi: z.string(),
  definitionEn: z.string().nullable(),
  usageNote: z.string().nullable(),
  collocations: z.array(z.string()),
  cefr: CefrLevelSchema.nullable(),
  topics: z.array(z.string()),
  note: z.string().nullable(),
  contexts: z.array(VocabContextSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const VocabContextInputSchema = z
  .object({
    sentence: z.string().trim().min(1).max(10_000),
    documentId: z.string().uuid().optional(),
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().positive().optional(),
    sourceUrl: z.url().max(2048).optional(),
  })
  .strict()
  .refine(
    context =>
      (context.startOffset === undefined && context.endOffset === undefined) ||
      (context.startOffset !== undefined &&
        context.endOffset !== undefined &&
        context.endOffset >= context.startOffset),
    {message: 'Both offsets must be provided and endOffset must be greater than or equal to startOffset.'},
  );

export const SaveVocabEntrySchema = z
  .object({
    headword: z.string().trim().min(1).max(120),
    lemma: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .transform(value => value.toLowerCase()),
    partOfSpeech: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .transform(value => value.toLowerCase()),
    ipa: z.string().trim().max(120).nullable().optional(),
    meaningVi: z.string().trim().min(1),
    definitionEn: z.string().trim().nullable().optional(),
    usageNote: z.string().trim().nullable().optional(),
    collocations: z.array(z.string().trim().min(1)).max(30).optional(),
    cefr: CefrLevelSchema.nullable().optional(),
    topics: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .transform(value => value.toLowerCase()),
      )
      .max(30)
      .optional(),
    context: VocabContextInputSchema.optional(),
  })
  .strict();

export const SaveVocabEntriesRequestSchema = z
  .object({entries: z.array(SaveVocabEntrySchema).min(1).max(100)})
  .strict();
export const SaveVocabEntriesResponseSchema = z.object({entries: z.array(VocabEntrySchema)});

export const ListVocabEntriesQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120).optional(),
    topic: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform(value => value.toLowerCase())
      .optional(),
    cefr: CefrLevelSchema.optional(),
    documentId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const ListVocabEntriesResponseSchema = z.object({
  entries: z.array(VocabEntrySchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const VocabEntryIdParamsSchema = z.object({id: z.string().uuid()}).strict();
export const UpdateVocabEntryRequestSchema = z.object({note: z.string().trim().max(2000).nullable()}).strict();
export const VocabEntryResponseSchema = z.object({entry: VocabEntrySchema});
export const DeleteVocabEntryResponseSchema = z.object({deleted: z.literal(true)});

export type VocabEntry = z.infer<typeof VocabEntrySchema>;
export type SaveVocabEntry = z.infer<typeof SaveVocabEntrySchema>;
export type ListVocabEntriesQuery = z.infer<typeof ListVocabEntriesQuerySchema>;
