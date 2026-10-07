import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  { ignores: ['dist/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: ['useAuth', 'useCart', 'useToast', 'useMyProducts', 'itemSummary', 'tileSpecs', 'useCompare', 'useTitle', 'safeNext', 'canShop', 'riderOnly', 'sellerOnly', 'adminOnly', 'adminArea', 'useTheme', 'useThemeColors'],
        },
      ],
    },
  },
  { files: ['scripts/**', 'vite.config.js', 'eslint.config.js', 'middleware.js'], languageOptions: { globals: globals.node } },
];
