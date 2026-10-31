import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['lib/', 'dist/', 'coverage/'],
    },
    {
        files: ['**/*.js'],
        extends: [js.configs.recommended, prettier],
        languageOptions: {
            sourceType: 'commonjs',
            globals: globals.node,
        },
    },
    {
        files: ['**/*.mjs'],
        extends: [js.configs.recommended, prettier],
        languageOptions: {
            sourceType: 'module',
            globals: globals.node,
        },
    },
    {
        files: ['**/*.ts'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.jest,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            // The published code targets ES5, "new Error(msg, { cause })" is not available there.
            'preserve-caught-error': 'off',
            'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
            'no-trailing-spaces': ['error', { skipBlankLines: true }],
            'require-await': 'error',
        },
    }
);
