// Starts the whole stack: postgres, workspace package builds, migrations, then all apps.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

if (!existsSync('.env')) {
	copyFileSync('.env.example', '.env');
	const key = randomBytes(32).toString('base64');
	writeFileSync('.env', readFileSync('.env', 'utf8').replace(/^CREDENTIALS_ENC_KEY=$/m, `CREDENTIALS_ENC_KEY=${key}`));
	console.log('[dev] created .env from .env.example with a generated CREDENTIALS_ENC_KEY');
}
process.loadEnvFile('.env');

const run = (cmd, args, env = process.env) => {
	const r = spawnSync(cmd, args, { stdio: 'inherit', env });
	if (r.status !== 0) {
		process.exit(r.status ?? 1);
	}
};

const adapterEnv = {
	...process.env,
	DATABASE_URL: process.env.ADAPTER_DATABASE_URL
		?? process.env.DATABASE_URL.replace('payments_api:payments', 'psp_adapter:adapter'),
};

console.log('[dev] starting postgres');
run('docker', ['compose', 'up', '-d', '--wait', 'postgres']);
console.log('[dev] building workspace packages');
run('pnpm', ['--filter', './packages/*', 'build']);
console.log('[dev] running migrations');
run('pnpm', ['--filter', '@payments/payments-api', 'db:migrate']);
run('pnpm', ['--filter', '@payments/psp-adapter', 'db:migrate'], adapterEnv);

const apps = [
	['payments-api', '@payments/payments-api', process.env],
	['psp-adapter', '@payments/psp-adapter', adapterEnv],
	['admin-ui', '@payments/admin-ui', process.env],
];
const children = apps.map(([label, filter, env]) => {
	const child = spawn('pnpm', ['--filter', filter, 'dev'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
	const prefix = (stream, out) => {
		let buf = '';
		stream.on('data', (d) => {
			buf += d;
			const lines = buf.split('\n');
			buf = lines.pop();
			for (const l of lines) {
				out.write(`[${label}] ${l}\n`);
			}
		});
	};
	prefix(child.stdout, process.stdout);
	prefix(child.stderr, process.stderr);
	child.on('exit', (code) => {
		console.log(`[dev] ${label} exited (${code})`);
		stop(code ?? 1);
	});
	return child;
});

let stopping = false;
function stop(code = 0) {
	if (stopping) {
		return;
	}
	stopping = true;
	children.forEach((c) => c.kill('SIGTERM'));
	setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
