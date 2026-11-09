import path from 'node:path';

import {defineConfig} from 'vitest/config';

// Same aliases as tsconfig.json, so tests import shared from source like the app does.
export default defineConfig({
  resolve: {
    alias: {
      '@linmaster/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@': __dirname,
    },
  },
});
