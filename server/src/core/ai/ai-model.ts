import {GoogleGenAI} from '@google/genai';

import type {AiPrompt} from './ai-task';

export interface AiModelRequest extends AiPrompt {
  /** JSON Schema of the expected output, generated from the task's Zod schema. */
  jsonSchema: unknown;
}

export interface AiModelResponse {
  /** Raw JSON text returned by the model, not yet validated. */
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** The single place the server talks to an LLM. Tests swap in `createMockAiModel`. */
export interface AiModel {
  name: string;
  generateJson(request: AiModelRequest): Promise<AiModelResponse>;
}

// A full test PDF took over 2 minutes in testing (it runs in the import job); a hung call must not hold forever.
const GEMINI_TIMEOUT_MS = 300_000;

/** Gemini through the official SDK, asking for JSON that follows `jsonSchema`. */
export function createGeminiModel(apiKey: string, model: string): AiModel {
  const client = new GoogleGenAI({apiKey, httpOptions: {timeout: GEMINI_TIMEOUT_MS}});

  return {
    name: model,
    async generateJson({system, text, pdf, jsonSchema}) {
      const parts = pdf
        ? [{inlineData: {mimeType: 'application/pdf', data: pdf.toString('base64')}}, {text}]
        : [{text}];
      const response = await client.models.generateContent({
        model,
        contents: [{role: 'user', parts}],
        config: {systemInstruction: system, responseMimeType: 'application/json', responseJsonSchema: jsonSchema},
      });
      return {
        text: response.text ?? '',
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
      };
    },
  };
}

/** Mock model for tests: returns the queued replies in order (a string reply is sent as raw text). */
export function createMockAiModel(replies: unknown[]): AiModel & {requests: AiModelRequest[]} {
  const requests: AiModelRequest[] = [];
  return {
    name: 'mock-model',
    requests,
    async generateJson(request) {
      requests.push(request);
      if (requests.length > replies.length) throw new Error('Mock AI model has no reply left.');
      const reply = replies[requests.length - 1];
      return {text: typeof reply === 'string' ? reply : JSON.stringify(reply), inputTokens: 10, outputTokens: 5};
    },
  };
}
