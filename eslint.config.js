import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  // 业务层架构红线：features / pages 不得直连 localStorage 或 axios，
  // 统一走 shared/api/localStorageClient 与 shared/api/client。
  // shared 层（localStorageClient / client / test-setup）不受此限制。
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='window'][property.name='localStorage']",
          message: '禁止直接使用 window.localStorage，请用 shared/api/localStorageClient',
        },
        {
          selector: "MemberExpression[object.name='localStorage']",
          message: '禁止直接使用 localStorage，请用 shared/api/localStorageClient',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message: '禁止直接 import axios，请用 shared/api/client',
            },
          ],
        },
      ],
    },
  },
])
