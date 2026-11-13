import { existsSync } from 'node:fs';

export function loadEnv() {
	if (!existsSync('.env')) {
		console.error('[dev] .env not found, run `pnpm run prep` first');
		process.exit(1);
	}
	process.loadEnvFile('.env');
	return {
		env: process.env,
		adapterEnv: {
			...process.env,
			DATABASE_URL: process.env.ADAPTER_DATABASE_URL
				?? process.env.DATABASE_URL.replace('payments_api:payments', 'psp_adapter:adapter'),
		},
	};
}
