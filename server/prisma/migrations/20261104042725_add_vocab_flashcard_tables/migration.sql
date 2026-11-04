-- CreateEnum
CREATE TYPE "StudyMode" AS ENUM ('flip', 'learn', 'test', 'match', 'exercise');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('again', 'hard', 'good', 'easy');

-- CreateEnum
CREATE TYPE "Cefr" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('paste', 'file', 'exam');

-- CreateTable
CREATE TABLE "FlashcardSet" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "termLang" VARCHAR(10) NOT NULL DEFAULT 'en',
    "definitionLang" VARCHAR(10) NOT NULL DEFAULT 'vi',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FlashcardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "example" TEXT,
    "vocabEntryId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "easiness" REAL NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "lastReviewedAt" TIMESTAMPTZ(6),

    CONSTRAINT "CardProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "mode" "StudyMode" NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(6),
    "cardsStudied" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "sessionId" UUID,
    "rating" "Rating" NOT NULL,
    "intervalBefore" INTEGER NOT NULL,
    "intervalAfter" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "source" "DocumentSource" NOT NULL,
    "paragraphs" JSONB NOT NULL,
    "sourceRef" JSONB,
    "wordCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabEntry" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "headword" VARCHAR(120) NOT NULL,
    "lemma" VARCHAR(120) NOT NULL,
    "partOfSpeech" VARCHAR(20) NOT NULL,
    "ipa" VARCHAR(120),
    "meaningVi" TEXT NOT NULL,
    "definitionEn" TEXT,
    "usageNote" TEXT,
    "collocations" TEXT[],
    "cefr" "Cefr",
    "topics" TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "VocabEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabContext" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "documentId" UUID,
    "sentence" TEXT NOT NULL,
    "startOffset" INTEGER,
    "endOffset" INTEGER,
    "sourceUrl" VARCHAR(2048),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabLookup" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "documentId" UUID,
    "text" VARCHAR(120) NOT NULL,
    "sentence" TEXT NOT NULL,
    "saved" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardProgress_userId_dueAt_idx" ON "CardProgress"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "CardProgress_userId_cardId_key" ON "CardProgress"("userId", "cardId");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_reviewedAt_idx" ON "ReviewLog"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "VocabEntry_topics_idx" ON "VocabEntry" USING GIN ("topics");

-- CreateIndex
CREATE UNIQUE INDEX "VocabEntry_ownerId_lemma_partOfSpeech_key" ON "VocabEntry"("ownerId", "lemma", "partOfSpeech");

-- CreateIndex
CREATE INDEX "VocabLookup_ownerId_createdAt_idx" ON "VocabLookup"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "FlashcardSet" ADD CONSTRAINT "FlashcardSet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "FlashcardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_vocabEntryId_fkey" FOREIGN KEY ("vocabEntryId") REFERENCES "VocabEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardProgress" ADD CONSTRAINT "CardProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardProgress" ADD CONSTRAINT "CardProgress_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_setId_fkey" FOREIGN KEY ("setId") REFERENCES "FlashcardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabEntry" ADD CONSTRAINT "VocabEntry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabContext" ADD CONSTRAINT "VocabContext_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "VocabEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabContext" ADD CONSTRAINT "VocabContext_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabLookup" ADD CONSTRAINT "VocabLookup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabLookup" ADD CONSTRAINT "VocabLookup_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
