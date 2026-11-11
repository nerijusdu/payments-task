import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
	{ ignores: ['**/dist/**', '**/node_modules/**', '**/drizzle/**'] },
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
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@stylistic/max-len': ['error', { code: 100, ignoreStrings: true, ignoreComments: true }],
		},
	},
);
