module.exports = {
    env: {
        browser: true,
        es2021: true,
        jest: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:jest/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint', 'jest'],
    rules: {
        'no-console': 'warn',
        'prefer-const': 'error',
        '@typescript-eslint/no-explicit-any': 'off',
        'jest/no-disabled-tests': 'warn',
        'jest/no-focused-tests': 'error',
    },
};