// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Generated output, not source. Without these, ESLint reports on the Expo
    // Router type stubs and on Wrangler's bundled worker shim, which buries the
    // real findings under noise about code nobody wrote.
    ignores: ['dist/*', '.expo/*', '.wrangler/*', 'expo-env.d.ts'],
  },
  {
    // Build tooling: Node scripts, not React Native. They use Node globals like
    // Buffer, and generate-icons.mjs imports `sharp` on purpose without it being
    // a dependency — it is run from a scratch directory, not from the app.
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: { Buffer: 'readonly', process: 'readonly', console: 'readonly', __dirname: 'readonly' },
    },
    rules: { 'import/no-unresolved': 'off' },
  },
]);
