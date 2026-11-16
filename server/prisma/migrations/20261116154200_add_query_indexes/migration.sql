-- CreateIndex
CREATE INDEX "Attempt_testId_idx" ON "Attempt"("testId");

-- CreateIndex
CREATE INDEX "AttemptAnswer_attemptId_idx" ON "AttemptAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "Card_setId_position_idx" ON "Card"("setId", "position");

-- CreateIndex
CREATE INDEX "CardProgress_cardId_idx" ON "CardProgress"("cardId");

-- CreateIndex
CREATE INDEX "Document_ownerId_updatedAt_idx" ON "Document"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "FlashcardSet_ownerId_idx" ON "FlashcardSet"("ownerId");

-- CreateIndex
CREATE INDEX "Passage_sectionId_idx" ON "Passage"("sectionId");

-- CreateIndex
CREATE INDEX "Question_groupId_idx" ON "Question"("groupId");

-- CreateIndex
CREATE INDEX "QuestionGroup_passageId_idx" ON "QuestionGroup"("passageId");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ReviewLog_sessionId_idx" ON "ReviewLog"("sessionId");

-- CreateIndex
CREATE INDEX "ReviewLog_cardId_idx" ON "ReviewLog"("cardId");

-- CreateIndex
CREATE INDEX "StudySession_userId_idx" ON "StudySession"("userId");

-- CreateIndex
CREATE INDEX "Test_ownerId_createdAt_idx" ON "Test"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "TestImport_ownerId_idx" ON "TestImport"("ownerId");

-- CreateIndex
CREATE INDEX "TestSection_testId_idx" ON "TestSection"("testId");

-- CreateIndex
CREATE INDEX "VocabContext_entryId_idx" ON "VocabContext"("entryId");

-- CreateIndex
CREATE INDEX "VocabContext_documentId_idx" ON "VocabContext"("documentId");

-- CreateIndex
CREATE INDEX "VocabEntry_ownerId_updatedAt_idx" ON "VocabEntry"("ownerId", "updatedAt");
