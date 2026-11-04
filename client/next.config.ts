import path from 'node:path';

import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./core/i18n/request.ts');

const nextConfig: NextConfig = {
  // Monorepo: dependencies are hoisted to the repo root.
  turbopack: {root: path.join(__dirname, '..')},
};

export default withNextIntl(nextConfig);
