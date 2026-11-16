// The real API (server/build) with the fake AI model, for Playwright. Run from server/ so uploads stay in
// server/uploads (git-ignored). Needs `npm run build -w server` first.
import process from 'node:process';

import {setAiModel} from '../../../server/build/core/ai/ai-gateway.js';
import {getEnv} from '../../../server/build/core/config/env.js';
import {createApp} from '../../../server/build/app.js';
import {createE2eAiModel} from './mock-ai.mjs';

setAiModel(createE2eAiModel());
const env = getEnv();
// The whole suite runs from one IP in about a minute and registers a learner in most tests; the real limits
// (120 requests a minute, 5 accounts an hour) are tested in server/tests.
createApp(env, {requestsPerMinute: 1000, registrationsPerHour: 1000}).listen(env.PORT, () =>
  process.stdout.write(`E2E API listening on http://localhost:${env.PORT}/api/v1\n`),
);
