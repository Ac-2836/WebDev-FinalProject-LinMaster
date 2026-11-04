-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('private', 'public', 'hidden');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('flashcard_set', 'test');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('wrong_content', 'copyright', 'inappropriate', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- AlterTable
ALTER TABLE "FlashcardSet" ADD COLUMN     "copiedFromId" UUID,
ADD COLUMN     "copyCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publishedAt" TIMESTAMPTZ(6),
ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'private';

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publishedAt" TIMESTAMPTZ(6),
ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'private';

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" "ContentType" NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "detail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_key" ON "Report"("reporterId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "FlashcardSet_visibility_publishedAt_idx" ON "FlashcardSet"("visibility", "publishedAt");

-- AddForeignKey
ALTER TABLE "FlashcardSet" ADD CONSTRAINT "FlashcardSet_copiedFromId_fkey" FOREIGN KEY ("copiedFromId") REFERENCES "FlashcardSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
