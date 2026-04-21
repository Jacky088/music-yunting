import tseslint from 'typescript-eslint';

export default [
    ...tseslint.configs.recommended,
    {
        files: ['js/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            'no-console': 'off',
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', '*.js', 'api/**'],
    }
];
