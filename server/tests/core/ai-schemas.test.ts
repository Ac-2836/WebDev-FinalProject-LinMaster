import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {classifyPagesTask} from '../../src/modules/exam/ai/classify-pages.v1';
import {explainAnswerTask} from '../../src/modules/exam/ai/explain-answer.v1';
import {parseAnswersTask} from '../../src/modules/exam/ai/parse-answers.v1';
import {parseAudioTask} from '../../src/modules/exam/ai/parse-audio.v2';
import {parseTestTask} from '../../src/modules/exam/ai/parse-test.v2';
import {parseTestV3Task} from '../../src/modules/exam/ai/parse-test.v3';
import {parseTranscriptTask} from '../../src/modules/exam/ai/parse-transcript.v1';
import {generateExerciseTask} from '../../src/modules/flashcard/ai/generate-exercise.v2';
import {explainWordTask} from '../../src/modules/vocab/ai/explain-word.v2';
import {scanDocumentTask} from '../../src/modules/vocab/ai/scan-document.v1';

// Gemini refuses a response schema that is too complex ("too many states for serving", HTTP 400), which only shows
// with the real model: generate-exercise.v1 had `maxItems` on an array of objects that hold arrays, and every
// request failed. These limits keep schemas well under what Gemini accepted when every task was tried for real.
const TASKS = [
  classifyPagesTask,
  parseTestTask,
  parseTestV3Task,
  parseAnswersTask,
  parseTranscriptTask,
  parseAudioTask,
  explainWordTask,
  scanDocumentTask,
  explainAnswerTask,
  generateExerciseTask,
];
const MAX_SCHEMA_BYTES = 4000;

interface Found {
  limitOverArrays: string[];
  patterns: string[];
}

const empty = (): Found => ({limitOverArrays: [], patterns: []});

/** An array without `maxItems` somewhere inside `node`. */
function hasUnlimitedArray(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasUnlimitedArray);
  if (!node || typeof node !== 'object') return false;
  const schema = node as Record<string, unknown>;
  if (schema.type === 'array' && typeof schema.maxItems !== 'number') return true;
  return Object.values(schema).some(hasUnlimitedArray);
}

function walk(node: unknown, path: string, found: Found): Found {
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${path}[${index}]`, found));
  } else if (node && typeof node === 'object') {
    const schema = node as Record<string, unknown>;
    if (schema.type === 'array' && typeof schema.maxItems === 'number') {
      if (hasUnlimitedArray(schema.items)) found.limitOverArrays.push(path);
    }
    if ('pattern' in schema) found.patterns.push(path);
    for (const [key, value] of Object.entries(schema)) {
      walk(value, `${path}.${key}`, found);
    }
  }
  return found;
}

describe('JSON Schemas sent to Gemini', () => {
  it.each(TASKS.map(task => [task.name, task] as const))('%s stays simple enough for Gemini', (_name, task) => {
    const schema = z.toJSONSchema(task.output);
    const found = walk(schema, task.name, empty());

    expect(JSON.stringify(schema).length).toBeLessThan(MAX_SCHEMA_BYTES);
    // No `maxItems` on an array whose items hold arrays without a limit: check the size on the server instead.
    expect(found.limitOverArrays).toEqual([]);
    expect(found.patterns).toEqual([]);
  });

  it('catches the shape that made generate-exercise fail', () => {
    const bad = z.toJSONSchema(z.object({questions: z.array(z.object({options: z.array(z.string())})).max(40)}));

    expect(walk(bad, 'bad', empty()).limitOverArrays).toEqual(['bad.properties.questions']);
  });
});
