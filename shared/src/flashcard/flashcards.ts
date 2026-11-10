import {z} from 'zod';

// Limits keep one editor save well inside the database transaction timeout (about 1 s for 500 cards).
export const MAX_CARDS_PER_SET = 500;
export const MAX_TERM_LENGTH = 500;
export const MAX_DEFINITION_LENGTH = 2000;
export const MAX_EXAMPLE_LENGTH = 2000;
export const MAX_SET_DESCRIPTION_LENGTH = 2000;

export const FlashcardCardSchema = z.object({
  id: z.string().uuid(),
  term: z.string(),
  definition: z.string(),
  example: z.string().nullable(),
  vocabEntryId: z.string().uuid().nullable(),
  position: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const FlashcardSetSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  termLang: z.string(),
  definitionLang: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  cards: z.array(FlashcardCardSchema),
});

export const FlashcardSetSummarySchema = FlashcardSetSchema.omit({cards: true}).extend({cardCount: z.number().int()});

export const CreateFlashcardSetSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(MAX_SET_DESCRIPTION_LENGTH).nullable().optional(),
    termLang: z.string().trim().min(2).max(10).default('en'),
    definitionLang: z.string().trim().min(2).max(10).default('vi'),
  })
  .strict();

export const UpdateFlashcardSetSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(MAX_SET_DESCRIPTION_LENGTH).nullable().optional(),
    termLang: z.string().trim().min(2).max(10).optional(),
    definitionLang: z.string().trim().min(2).max(10).optional(),
  })
  .strict()
  .refine(value => Object.keys(value).length > 0, {message: 'At least one field must be provided.'});

export const ReplaceFlashcardCardInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    term: z.string().trim().min(1).max(MAX_TERM_LENGTH),
    definition: z.string().trim().min(1).max(MAX_DEFINITION_LENGTH),
    example: z.string().trim().max(MAX_EXAMPLE_LENGTH).nullable().optional(),
    vocabEntryId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const ReplaceFlashcardCardsRequestSchema = z
  .object({cards: z.array(ReplaceFlashcardCardInputSchema).max(MAX_CARDS_PER_SET)})
  .strict()
  .refine(
    value => {
      const ids = value.cards.flatMap(card => (card.id ? [card.id] : []));
      return new Set(ids).size === ids.length;
    },
    {message: 'Card IDs must be unique.'},
  );

export const CreateFlashcardSetFromVocabSchema = CreateFlashcardSetSchema.extend({
  vocabIds: z.array(z.string().uuid()).min(1).max(100),
})
  .strict()
  .refine(value => new Set(value.vocabIds).size === value.vocabIds.length, {
    message: 'Vocabulary entry IDs must be unique.',
  });

export const FlashcardSetIdParamsSchema = z.object({id: z.string().uuid()}).strict();

export const CreateFlashcardSetResponseSchema = z.object({set: FlashcardSetSchema});
export const ListFlashcardSetsResponseSchema = z.object({sets: z.array(FlashcardSetSummarySchema)});
export const GetFlashcardSetResponseSchema = z.object({set: FlashcardSetSchema});
export const ReplaceFlashcardCardsResponseSchema = z.object({cards: z.array(FlashcardCardSchema)});
export const DeleteFlashcardSetResponseSchema = z.object({deleted: z.literal(true)});

export type FlashcardSet = z.infer<typeof FlashcardSetSchema>;
export type FlashcardCard = z.infer<typeof FlashcardCardSchema>;
export type CreateFlashcardSet = z.infer<typeof CreateFlashcardSetSchema>;
export type UpdateFlashcardSet = z.infer<typeof UpdateFlashcardSetSchema>;
export type ReplaceFlashcardCardInput = z.infer<typeof ReplaceFlashcardCardInputSchema>;
export type CreateFlashcardSetFromVocab = z.infer<typeof CreateFlashcardSetFromVocabSchema>;
