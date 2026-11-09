import {existsSync} from 'node:fs';

import {createApp} from './app';
import {getEnv} from './core/config/env';

if (existsSync('.env')) process.loadEnvFile('.env');

let env;
try {
  env = getEnv();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

createApp(env).listen(env.PORT, () => {
  console.log(`LinMaster API listening on http://localhost:${env.PORT}/api/v1`);
});
