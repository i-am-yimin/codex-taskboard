import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
export default ts.config({ ignores: ['**/dist/**', '**/resources/**', 'apps/desktop/runtime/**', 'apps/desktop/binaries/**', '**/target/**', '.data/**', '.artifacts/**', 'playwright-report/**', 'test-results/**'] }, js.configs.recommended, ...ts.configs.recommended, {
  files: ['**/*.{js,ts,tsx}'], languageOptions: { globals: { ...globals.node, ...globals.browser } },
  rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], '@typescript-eslint/no-explicit-any': 'error' }
});
