// Fake LLM for the e2e API (P4-08): never calls Gemini. Each AI task is recognised by the first words of its
// system prompt and gets a fixed reply that follows the task's output schema.
import {PDFDocument} from 'pdf-lib';

const USER_DATA = /<<<USER_DATA>>>\n([\s\S]*?)\n<<<END_USER_DATA>>>/gu;

/** Blocks wrapped with `wrapUserData`, in prompt order. */
function userData(text) {
  return [...text.matchAll(USER_DATA)].map(match => match[1]);
}

function explainWord(text) {
  // The document title and paragraph come first when the client sends context, so find the block by its label.
  const selected = text.match(/Selected text \([^\n]*\n<<<USER_DATA>>>\n([\s\S]*?)\n<<<END_USER_DATA>>>/u)[1];
  return {
    headword: selected,
    lemma: selected.toLowerCase(),
    partOfSpeech: 'verb',
    ipa: '/ˈe2e/',
    meaningVi: `nghĩa thử của ${selected}`,
    definitionEn: 'a definition written by the e2e mock',
    usageNote: null,
    collocations: [`${selected} the effects`],
    cefr: 'C1',
    topics: ['environment'],
  };
}

/** Two words of seven letters or more from the first sentence of the document, with that sentence as is. */
function scanDocument(text) {
  const document = userData(text).at(-1);
  const sentence = document.split('\n')[0].split(/(?<=[.!?])\s+/u)[0];
  const words = [...new Set(sentence.match(/[A-Za-z]{7,}/gu) ?? [])].slice(0, 2);
  return {
    candidates: words.map(word => ({
      headword: word,
      lemma: word.toLowerCase(),
      partOfSpeech: 'noun',
      meaningVi: `nghĩa thử của ${word}`,
      cefr: 'B2',
      topics: ['environment'],
      sentence,
    })),
  };
}

/** The e2e PDFs say their skill in their title (metadata): "E2E Listening test" is Listening, any other Reading. */
async function skillOf(pdf) {
  const title = (await PDFDocument.load(pdf, {updateMetadata: false})).getTitle() ?? '';
  return title.includes('Listening') ? 'listening' : 'reading';
}

/** One test in a PDF: the last page is the answer key, the other pages the passage and questions. */
async function classifyPages(pdf) {
  const count = (await PDFDocument.load(pdf)).getPageCount();
  const skill = await skillOf(pdf);
  return {
    pages: Array.from({length: count}, (_, index) => ({
      page: index + 1,
      labels: count > 1 && index === count - 1 ? ['answers'] : ['passage', 'questions'],
      skill,
      questionRange: {from: 1, to: 40},
    })),
  };
}

const NUMBERS = Array.from({length: 40}, (_, index) => index + 1);
/** Answer of question n in the fake key: TRUE for odd numbers, FALSE for even ones. */
export const answerOf = n => (n % 2 === 1 ? 'TRUE' : 'FALSE');

/** Answer of Listening question n in the fake key: B for every question. */
export const LISTENING_ANSWER = 'B';
const OPTIONS = ['A', 'B', 'C'].map(key => ({key, text: `Option ${key}`}));

/** Four Listening parts of ten multiple-choice questions, without a transcript. */
function parseListening() {
  return {
    title: 'E2E Listening test',
    hasTranscript: false,
    sections: [
      {
        skill: 'listening',
        passages: [1, 2, 3, 4].map(part => ({
          title: `Part ${part}`,
          paragraphs: null,
          groups: [
            {
              kind: 'single_choice',
              fromNo: part * 10 - 9,
              toNo: part * 10,
              instructions: 'Choose the correct letter, A, B or C.',
              wordLimit: null,
              optionsTitle: null,
              options: null,
              content: null,
              questions: NUMBERS.slice(part * 10 - 10, part * 10).map(number => ({
                number,
                prompt: `Listening question ${number}.`,
                options: OPTIONS,
              })),
            },
          ],
        })),
      },
    ],
  };
}

function parseTest() {
  return {
    title: 'E2E Reading test',
    hasTranscript: false,
    sections: [
      {
        skill: 'reading',
        passages: [
          {
            title: 'Cities and the rising sea',
            paragraphs: [
              {label: 'A', text: 'Coastal cities face mounting pressure from rising seas.'},
              {label: 'B', text: 'Some planners advocate managed retreat, while others favour sea walls.'},
            ],
            groups: [
              {
                kind: 'tfng',
                fromNo: 1,
                toNo: 40,
                instructions: 'Do the following statements agree with the information given in the passage?',
                wordLimit: null,
                optionsTitle: null,
                options: null,
                content: null,
                questions: NUMBERS.map(number => ({number, prompt: `Statement number ${number}.`, options: null})),
              },
            ],
          },
        ],
      },
    ],
  };
}

function parseAnswers(skill) {
  return {
    answers: NUMBERS.map(number => ({
      skill,
      number,
      answer: skill === 'listening' ? LISTENING_ANSWER : answerOf(number),
      explanation: `Explanation of question ${number}.`,
    })),
  };
}

const REPLIES = [
  ['You explain English words', ({text}) => explainWord(text)],
  ['You help Vietnamese learners', ({text}) => scanDocument(text)],
  ['You label the pages', ({pdf}) => classifyPages(pdf)],
  [
    'You convert an IELTS-style test PDF',
    async ({pdf}) => ((await skillOf(pdf)) === 'listening' ? parseListening() : parseTest()),
  ],
  ['You read the answer key', async ({pdf}) => parseAnswers(await skillOf(pdf))],
  ['You read the transcript', () => ({parts: []})],
];

/** `AiModel` (server/src/core/ai/ai-model.ts) answering every registered task without a network call. */
export function createE2eAiModel() {
  return {
    name: 'e2e-mock',
    async generateJson(request) {
      const reply = REPLIES.find(([start]) => request.system.startsWith(start));
      if (!reply) throw new Error(`The e2e AI mock has no reply for: ${request.system.slice(0, 60)}`);
      return {text: JSON.stringify(await reply[1](request)), inputTokens: 1, outputTokens: 1};
    },
  };
}
