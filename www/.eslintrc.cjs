module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'vite.config.ts', 'src/vite-env.d.ts'],
  parser: '@typescript-eslint/parser',
  rules: {
    'no-unused-vars': 'off',
  },
};