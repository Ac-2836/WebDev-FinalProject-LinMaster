-- CreateEnum
CREATE TYPE "TestKind" AS ENUM ('reading', 'listening', 'full');

-- CreateEnum
CREATE TYPE "Skill" AS ENUM ('listening', 'reading');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('queued', 'parsing', 'validating', 'done', 'failed');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('in_progress', 'submitted');

-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('single_choice', 'multi_choice', 'tfng', 'ynng', 'matching', 'completion', 'short_answer', 'diagram_label');

-- CreateTable
CREATE TABLE "Test" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "certification" VARCHAR(40) NOT NULL,
    "kind" "TestKind" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "source" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSection" (
    "id" UUID NOT NULL,
    "testId" UUID NOT NULL,
    "skill" "Skill" NOT NULL,
    "position" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "audioFileId" UUID,

    CONSTRAINT "TestSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passage" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "paragraphs" JSONB,
    "audioStartSec" INTEGER,

    CONSTRAINT "Passage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" UUID NOT NULL,
    "passageId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "QuestionKind" NOT NULL,
    "fromNo" INTEGER NOT NULL,
    "toNo" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "sharedOptions" JSONB,
    "wordLimit" INTEGER,
    "imageFileId" UUID,

    CONSTRAINT "QuestionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "answer" JSONB NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestImport" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "kind" "TestKind" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'queued',
    "questionFileId" UUID NOT NULL,
    "answerFileId" UUID NOT NULL,
    "audioFileId" UUID,
    "errors" JSONB,
    "testId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(6),

    CONSTRAINT "TestImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "testId" UUID NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMPTZ(6) NOT NULL,
    "submittedAt" TIMESTAMPTZ(6),
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "state" JSONB NOT NULL,
    "listeningCorrect" INTEGER,
    "readingCorrect" INTEGER,
    "listeningBand" DECIMAL(2,1),
    "readingBand" DECIMAL(2,1),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptAnswer" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionId" UUID,
    "questionNumber" INTEGER NOT NULL,
    "skill" "Skill" NOT NULL,
    "kind" "QuestionKind" NOT NULL,
    "given" JSONB,
    "correctAnswer" JSONB NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "AttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attempt_userId_testId_idx" ON "Attempt"("userId", "testId");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSection" ADD CONSTRAINT "TestSection_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSection" ADD CONSTRAINT "TestSection_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passage" ADD CONSTRAINT "Passage_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TestSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestImport" ADD CONSTRAINT "TestImport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestImport" ADD CONSTRAINT "TestImport_questionFileId_fkey" FOREIGN KEY ("questionFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestImport" ADD CONSTRAINT "TestImport_answerFileId_fkey" FOREIGN KEY ("answerFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestImport" ADD CONSTRAINT "TestImport_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestImport" ADD CONSTRAINT "TestImport_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written (Prisma has no partial indexes): at most one in_progress attempt per learner and test.
CREATE UNIQUE INDEX "Attempt_one_in_progress_per_user_test" ON "Attempt"("userId", "testId") WHERE "status" = 'in_progress';
