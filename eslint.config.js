import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
	{ ignores: ['**/dist/**', '**/node_modules/**', '**/drizzle/**', '**/.next/**', '**/next-env.d.ts'] },
	...tseslint.configs.recommended,
	stylistic.configs.customize({
		indent: 'tab',
		quotes: 'single',
		semi: true,
		commaDangle: 'always-multiline',
		arrowParens: true,
		braceStyle: '1tbs',
	}),
	{
		rules: {
			'curly': ['error', 'all'],
			'@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@stylistic/max-len': ['error', { code: 100, ignoreStrings: true, ignoreComments: true }],
		},
	},	{
		files: ['apps/admin-ui/**/*.{ts,tsx}'],
		rules: {
			'@stylistic/max-len': 'off',
			'@stylistic/jsx-one-expression-per-line': 'off',
		},
	},
);
