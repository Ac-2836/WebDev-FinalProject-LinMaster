import {createHash} from 'node:crypto';

import {z} from 'zod';

import type {PrismaClient} from '../../generated/prisma/client';
import {AppError} from '../app-error';
import {getEnv} from '../config/env';
import {getDb} from '../db';
import {type AiModel, createGeminiModel} from './ai-model';
import {type AiTask, aiTaskRegistry} from './ai-task';

/** AI calls (cache misses) one user may make per day. */
export const AI_DAILY_QUOTA = 50;
/** First call plus two retries when the model returns JSON that fails the task schema (PLAN C0). */
export const AI_MAX_ATTEMPTS = 3;
// Quota days start at midnight Vietnam time (UTC+7, no daylight saving).
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AiGatewayDeps {
  db: PrismaClient;
  model: AiModel;
  dailyQuota?: number;
  now?: () => Date;
}

export interface RunJsonTaskOptions {
  /** The signed-in user; quota and AiUsage are counted per user. */
  userId: string;
}

/** Start of the current Vietnam day and of the next one, as UTC instants. */
export function vietnamDayBounds(now: Date): {start: Date; end: Date} {
  const start = Math.floor((now.getTime() + VIETNAM_OFFSET_MS) / DAY_MS) * DAY_MS - VIETNAM_OFFSET_MS;
  return {start: new Date(start), end: new Date(start + DAY_MS)};
}

function hashPrompt(taskName: string, system: string, text: string, pdf?: Buffer): string {
  const hash = createHash('sha256').update(taskName).update('\0').update(system).update('\0').update(text);
  if (pdf) hash.update('\0').update(pdf);
  return hash.digest('hex');
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Builds the gateway around a database and a model, so tests can pass the mock model. */
export function createAiGateway({db, model, dailyQuota = AI_DAILY_QUOTA, now = () => new Date()}: AiGatewayDeps) {
  /**
   * Runs one registered AI task for a user: quota → cache → model with schema validation, content check
   * (`task.isComplete`) and retry → AiUsage.
   * Throws AppError 429 AI_QUOTA_EXCEEDED, 502 AI_INVALID_OUTPUT or 503 AI_UNAVAILABLE.
   */
  async function runJsonTask<Input, Output>(
    task: AiTask<Input, Output>,
    input: Input,
    {userId}: RunJsonTaskOptions,
  ): Promise<Output> {
    if (!aiTaskRegistry.has(task.name)) throw new Error(`AI task "${task.name}" is not registered.`);

    const {start, end} = vietnamDayBounds(now());
    const used = await db.aiUsage.count({where: {userId, cached: false, createdAt: {gte: start, lt: end}}});
    if (used >= dailyQuota) {
      throw new AppError('Bạn đã dùng hết lượt AI hôm nay.', 429, {retryAt: end.toISOString()}, 'AI_QUOTA_EXCEEDED');
    }

    const prompt = task.buildPrompt(input);
    const inputHash = hashPrompt(task.name, prompt.system, prompt.text, prompt.pdf);
    const cached = await db.aiCache.findUnique({where: {task_inputHash: {task: task.name, inputHash}}});
    if (cached && (cached.expiresAt === null || cached.expiresAt > now())) {
      const output = task.output.safeParse(cached.output);
      if (output.success && (task.isComplete?.(output.data, input) ?? true)) {
        await db.aiUsage.create({data: {userId, task: task.name, cached: true}});
        return output.data;
      }
    }

    const jsonSchema = z.toJSONSchema(task.output);
    let inputTokens = 0;
    let outputTokens = 0;
    let incomplete: {output: Output} | undefined;
    for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
      let response;
      try {
        response = await model.generateJson({...prompt, jsonSchema});
      } catch (error) {
        console.error(`AI task ${task.name} failed to reach the model:`, error);
        throw new AppError('Dịch vụ AI tạm thời không phản hồi, hãy thử lại sau.', 503, undefined, 'AI_UNAVAILABLE');
      }
      inputTokens += response.inputTokens ?? 0;
      outputTokens += response.outputTokens ?? 0;

      const output = task.output.safeParse(parseJson(response.text));
      if (!output.success) continue;
      if (task.isComplete && !task.isComplete(output.data, input)) {
        incomplete = {output: output.data};
        continue;
      }

      const expiresAt = task.cacheTtlSeconds ? new Date(now().getTime() + task.cacheTtlSeconds * 1000) : null;
      const row = {output: output.data as object, model: model.name, expiresAt};
      // Upsert: an expired row is refreshed, and two identical calls at once do not hit the unique key.
      await db.aiCache.upsert({
        where: {task_inputHash: {task: task.name, inputHash}},
        create: {task: task.name, inputHash, ...row},
        update: row,
      });
      await db.aiUsage.create({data: {userId, task: task.name, cached: false, inputTokens, outputTokens}});
      return output.data;
    }

    if (incomplete) {
      // Valid but missing content every time: hand it back uncached, so a later run can still get a full one.
      console.warn(`AI task ${task.name} returned incomplete output after ${AI_MAX_ATTEMPTS} attempts.`);
      await db.aiUsage.create({data: {userId, task: task.name, cached: false, inputTokens, outputTokens}});
      return incomplete.output;
    }
    throw new AppError('AI trả về kết quả không hợp lệ, hãy thử lại.', 502, undefined, 'AI_INVALID_OUTPUT');
  }

  return {runJsonTask};
}

let model: AiModel | undefined;
let gateway: ReturnType<typeof createAiGateway> | undefined;

/** Replaces the model of the shared gateway, e.g. with `createMockAiModel` in route tests. */
export function setAiModel(next: AiModel): void {
  model = next;
  gateway = undefined;
}

function getGateway() {
  if (!gateway) {
    if (!model) {
      const {GEMINI_API_KEY, GEMINI_MODEL} = getEnv();
      if (!GEMINI_API_KEY) {
        throw new AppError('Dịch vụ AI chưa được cấu hình.', 503, undefined, 'AI_UNAVAILABLE');
      }
      model = createGeminiModel(GEMINI_API_KEY, GEMINI_MODEL);
    }
    gateway = createAiGateway({db: getDb(), model});
  }
  return gateway;
}

/** Runs an AI task through the shared gateway (Gemini, or the model set by `setAiModel`). */
export function runJsonTask<Input, Output>(
  task: AiTask<Input, Output>,
  input: Input,
  options: RunJsonTaskOptions,
): Promise<Output> {
  return getGateway().runJsonTask(task, input, options);
}
