// Sample tests for the exam room (P3-03), so it can be built and tested without the upload flow.
// Content: synthetic tests R0 and L0, written by AI for testing only (not real IELTS tests), owner-approved 07/11/2026.
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {CERTIFICATIONS, type ParsedTest, ParsedTestSchema, parseAnswer} from '@linmaster/shared';

import {storage} from '../src/core/storage';
import type {Prisma, PrismaClient} from '../src/generated/prisma/client';

const SAMPLE_FILES = ['sample-reading-test.json', 'sample-listening-test.json'];
const CERTIFICATION = CERTIFICATIONS.IELTS_ACADEMIC;
// Length of the L0 audio (D:\LinMaster-de-mau\listening\_audio\listening-audio.mp3), 842.6 s.
const SAMPLE_AUDIO_DURATION_SEC = 843;

/** Reads a sample test and checks it like the import validator will: structure, numbering, answers per kind. */
export function loadSampleTest(file: string): ParsedTest {
  const test = ParsedTestSchema.parse(JSON.parse(readFileSync(path.join(__dirname, 'seed-data', file), 'utf8')));
  for (const section of test.sections) {
    const spec = CERTIFICATION.sections[section.skill];
    const questions = section.passages.flatMap(passage => passage.groups.flatMap(group => group.questions));
    const numbers = questions.map(question => question.number);
    const expected = Array.from({length: spec.questionCount}, (_, index) => index + 1);
    if (section.passages.length !== spec.parts || numbers.join() !== expected.join()) {
      throw new Error(`${file}: ${section.skill} needs ${spec.parts} parts and questions 1–${spec.questionCount}.`);
    }
    for (const group of section.passages.flatMap(passage => passage.groups)) {
      for (const question of group.questions) {
        const answer = parseAnswer(group.kind, question.answer);
        if (!answer.success)
          throw new Error(`${file}: question ${question.number} has an invalid ${group.kind} answer.`);
        question.answer = answer.data;
      }
    }
  }
  return test;
}

function toCreateInput(test: ParsedTest, ownerId: string, audioFileId: string | null): Prisma.TestCreateInput {
  return {
    owner: {connect: {id: ownerId}},
    certification: CERTIFICATION.id,
    kind: test.kind,
    title: test.title,
    source: test.source,
    sections: {
      create: test.sections.map((section, sectionIndex) => ({
        skill: section.skill,
        position: sectionIndex + 1,
        durationSec: CERTIFICATION.sections[section.skill].durationSec,
        audioFile: section.skill === 'listening' && audioFileId ? {connect: {id: audioFileId}} : undefined,
        passages: {
          create: section.passages.map((passage, passageIndex) => ({
            position: passageIndex + 1,
            title: passage.title,
            paragraphs: passage.paragraphs ?? undefined,
            audioStartSec: passage.audioStartSec,
            groups: {
              create: passage.groups.map((group, groupIndex) => ({
                position: groupIndex + 1,
                kind: group.kind,
                fromNo: group.fromNo,
                toNo: group.toNo,
                instructions: group.instructions,
                wordLimit: group.wordLimit,
                sharedOptions: group.shared ?? undefined,
                questions: {
                  create: group.questions.map(question => ({
                    number: question.number,
                    prompt: question.prompt,
                    options: question.options ?? undefined,
                    answer: question.answer as Prisma.InputJsonValue,
                  })),
                },
              })),
            },
          })),
        },
      })),
    },
  };
}

/**
 * Stores the Listening audio through the core storage driver when SEED_LISTENING_AUDIO points to the L0 MP3.
 * shortcut: without it the Listening test has no audio; the file is too big for the repo (6.7 MB).
 */
async function storeSampleAudio(db: PrismaClient, ownerId: string): Promise<string | null> {
  const audioPath = process.env.SEED_LISTENING_AUDIO;
  if (!audioPath || !existsSync(audioPath)) {
    console.log('Seed: SEED_LISTENING_AUDIO not set or missing, the sample Listening test has no audio.');
    return null;
  }
  const stored = await storage.put({
    mimeType: 'audio/mpeg',
    originalName: path.basename(audioPath),
    data: readFileSync(audioPath),
  });
  const file = await db.storedFile.create({
    data: {
      ownerId,
      storageKey: stored.key,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      originalName: stored.originalName,
      durationSec: SAMPLE_AUDIO_DURATION_SEC,
    },
  });
  return file.id;
}

/** Replaces the demo user's tests and stored files with the sample Reading and Listening tests. */
export async function seedSampleTests(db: PrismaClient, ownerId: string) {
  const tests = SAMPLE_FILES.map(loadSampleTest);

  // Tests first: their sections point to the stored audio.
  await db.test.deleteMany({where: {ownerId}});
  const oldFiles = await db.storedFile.findMany({where: {ownerId}, select: {storageKey: true}});
  await db.storedFile.deleteMany({where: {ownerId}});
  await Promise.all(oldFiles.map(file => storage.delete(file.storageKey)));

  const audioFileId = await storeSampleAudio(db, ownerId);
  for (const test of tests) await db.test.create({data: toCreateInput(test, ownerId, audioFileId)});

  console.log(`Seed: ${tests.length} sample tests (Reading, Listening${audioFileId ? ' with audio' : ''}).`);
}
