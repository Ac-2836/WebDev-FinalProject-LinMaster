import {getDb} from '../../src/core/db';

/** Secrets stored in a fixture test; none of them may reach a candidate before submitting. */
export function testSecrets(run: string) {
  return {
    answer: `answer-${run}`,
    explanation: `explanation-${run}`,
    transcript: `transcript-${run}`,
    hiddenKey: `hidden-${run}`,
  };
}

export interface FixtureTestOptions {
  ownerId: string;
  title: string;
  run: string;
  visibility?: 'private' | 'public' | 'hidden';
  audioFileId?: string;
}

/**
 * A Full test: Listening (30 min, transcript, questions 1–2) then Reading (60 min, question 1); answers carry an
 * explanation and the jsonb columns carry unknown keys.
 */
export async function createFixtureTest({
  ownerId,
  title,
  run,
  visibility = 'private',
  audioFileId,
}: FixtureTestOptions) {
  const secrets = testSecrets(run);
  const answer = {accepted: [secrets.answer], explanation: secrets.explanation};
  return getDb().test.create({
    data: {
      ownerId,
      certification: 'IELTS_ACADEMIC',
      kind: 'full',
      title,
      visibility,
      sections: {
        create: [
          {
            skill: 'reading',
            position: 2,
            durationSec: 3600,
            passages: {
              create: {
                position: 1,
                title: 'Urban farming',
                paragraphs: [{label: 'A', text: 'Farms grow on roofs.', note: secrets.hiddenKey}],
                groups: {
                  create: {
                    position: 1,
                    kind: 'single_choice',
                    fromNo: 1,
                    toNo: 1,
                    instructions: 'Choose the correct letter.',
                    sharedOptions: {optionsTitle: 'Options', answerKey: secrets.hiddenKey},
                    questions: {
                      create: {
                        number: 1,
                        prompt: 'Where do farms grow?',
                        options: [{key: 'A', text: 'On roofs', correct: secrets.hiddenKey}],
                        answer: {key: 'A', explanation: secrets.explanation},
                      },
                    },
                  },
                },
              },
            },
          },
          {
            skill: 'listening',
            position: 1,
            durationSec: 1800,
            audioFileId: audioFileId ?? null,
            passages: {
              create: {
                position: 1,
                title: 'Part 1',
                paragraphs: [{label: 'Woman', text: secrets.transcript}],
                audioStartSec: 0,
                groups: {
                  create: {
                    position: 1,
                    kind: 'completion',
                    fromNo: 1,
                    toNo: 2,
                    instructions: 'Write ONE WORD ONLY.',
                    wordLimit: 1,
                    questions: {
                      create: [
                        {number: 1, prompt: 'Meet at the {{blank}}', answer},
                        {number: 2, prompt: 'Bring a {{blank}}', answer},
                      ],
                    },
                  },
                },
              },
            },
          },
        ],
      },
    },
  });
}
