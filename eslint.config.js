const ignores = require('./eslint.ignores.js');

module.exports = [
  {ignores},
  ...require('gts'),
  {
    // The client is a Next.js app with its own tsconfig (JSX, `@/` alias).
    files: ['client/**/*.ts', 'client/**/*.tsx'],
    languageOptions: {parserOptions: {project: './client/tsconfig.json', tsconfigRootDir: __dirname}},
  },
];
