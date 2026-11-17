import type {GeneratedExercise} from '@linmaster/shared';

import {runJsonTask} from '../../../core/ai/ai-gateway';
import {type GenerateExerciseInput, generateExerciseTask} from './generate-exercise.v2';

// AI tasks of the flashcard module (KH's part). The service calls only the functions exported here.

/** Practice questions for a set with `generate-exercise.v2`; the caller checks them with `buildExercise`. */
export function generateExercise(input: GenerateExerciseInput, userId: string): Promise<GeneratedExercise> {
  return runJsonTask(generateExerciseTask, input, {userId});
}
