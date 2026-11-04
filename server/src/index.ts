import {existsSync} from 'node:fs';

import {createApp} from './app';
import {parseEnv} from './core/config/env';

if (existsSync('.env')) process.loadEnvFile('.env');

let env;
try {
  env = parseEnv(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

createApp().listen(env.PORT, () => {
  console.log(`LinMaster API listening on http://localhost:${env.PORT}/api/v1`);
});
