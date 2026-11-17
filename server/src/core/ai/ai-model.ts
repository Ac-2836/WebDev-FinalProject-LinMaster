import {createPartFromUri, FileState, GoogleGenAI, type Part} from '@google/genai';

import type {AiPrompt} from './ai-task';

export interface AiModelRequest extends AiPrompt {
  /** JSON Schema of the expected output, generated from the task's Zod schema. */
  jsonSchema: unknown;
  /** How long this call may take before it is cut off (counts as a failure the gateway may retry). */
  timeoutMs: number;
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

/** A request with inline data may hold about 20 MB in all; bigger recordings go through the Files API. */
export const MAX_INLINE_AUDIO_BYTES = 12 * 1024 * 1024;
const FILE_POLL_MS = 2000;

/** Uploads a recording and waits until Gemini has processed it, within the call's time limit. */
async function uploadAudio(client: GoogleGenAI, audio: NonNullable<AiPrompt['audio']>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let file = await client.files.upload({
    file: new Blob([new Uint8Array(audio.data)], {type: audio.mimeType}),
    config: {mimeType: audio.mimeType},
  });
  while (file.state === FileState.PROCESSING) {
    if (Date.now() > deadline) throw new Error('Gemini did not finish processing the audio file in time.');
    await new Promise(resolve => setTimeout(resolve, FILE_POLL_MS));
    file = await client.files.get({name: file.name!});
  }
  if (file.state === FileState.FAILED || !file.uri) throw new Error('Gemini could not process the audio file.');
  return file;
}

/** Gemini through the official SDK, asking for JSON that follows `jsonSchema`. */
export function createGeminiModel(apiKey: string, model: string): AiModel {
  const client = new GoogleGenAI({apiKey});

  return {
    name: model,
    async generateJson({system, text, pdf, audio, jsonSchema, timeoutMs}) {
      let uploaded: string | undefined;
      try {
        const parts: Part[] = [];
        if (pdf) parts.push({inlineData: {mimeType: 'application/pdf', data: pdf.toString('base64')}});
        if (audio && audio.data.length <= MAX_INLINE_AUDIO_BYTES) {
          parts.push({inlineData: {mimeType: audio.mimeType, data: audio.data.toString('base64')}});
        } else if (audio) {
          const file = await uploadAudio(client, audio, timeoutMs);
          uploaded = file.name;
          parts.push(createPartFromUri(file.uri!, audio.mimeType));
        }
        parts.push({text});
        const response = await client.models.generateContent({
          model,
          contents: [{role: 'user', parts}],
          config: {
            systemInstruction: system,
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            httpOptions: {timeout: timeoutMs},
          },
        });
        return {
          text: response.text ?? '',
          inputTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
        };
      } finally {
        // Best effort: Gemini deletes uploaded files after 48 hours anyway.
        if (uploaded) await client.files.delete({name: uploaded}).catch(() => undefined);
      }
    },
  };
}

/**
 * Mock model for tests: returns the queued replies in order (a string reply is sent as raw text, an Error reply is
 * thrown, like a network failure or an API error with `status`).
 */
export function createMockAiModel(replies: unknown[]): AiModel & {requests: AiModelRequest[]} {
  const requests: AiModelRequest[] = [];
  return {
    name: 'mock-model',
    requests,
    async generateJson(request) {
      requests.push(request);
      if (requests.length > replies.length) throw new Error('Mock AI model has no reply left.');
      const reply = replies[requests.length - 1];
      if (reply instanceof Error) throw reply;
      return {text: typeof reply === 'string' ? reply : JSON.stringify(reply), inputTokens: 10, outputTokens: 5};
    },
  };
}
