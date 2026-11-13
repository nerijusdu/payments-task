// One-time setup: .env files, dependencies, postgres, builds, migrations, seed data.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { loadEnv } from './env.mjs';

const SHOP_ENV = 'examples/shop/.env.local';

const run = (cmd, args, env = process.env) => {
	const r = spawnSync(cmd, args, { stdio: 'inherit', env });
	if (r.status !== 0) {
		process.exit(r.status ?? 1);
	}
};

if (!existsSync('.env')) {
	copyFileSync('.env.example', '.env');
	const key = randomBytes(32).toString('base64');
	const text = readFileSync('.env', 'utf8');
	writeFileSync('.env', text.replace(/^CREDENTIALS_ENC_KEY=$/m, `CREDENTIALS_ENC_KEY=${key}`));
	console.log('[prep] created .env with a generated CREDENTIALS_ENC_KEY');
}
if (!existsSync(SHOP_ENV)) {
	copyFileSync('examples/shop/.env.example', SHOP_ENV);
	console.log(`[prep] created ${SHOP_ENV}`);
}
const { env, adapterEnv } = loadEnv();

console.log('[prep] installing dependencies');
if (!existsSync('node_modules')) {
	run('pnpm', ['install']);
}
// The example shop is a standalone npm project outside the pnpm workspace.
run('npm', ['install', '--prefix', 'examples/shop']);

console.log('[prep] starting postgres');
run('docker', ['compose', 'up', '-d', '--wait', 'postgres']);
console.log('[prep] building workspace packages');
run('pnpm', ['--filter', './packages/*', 'build']);
console.log('[prep] running migrations');
run('pnpm', ['--filter', '@payments/payments-api', 'db:migrate']);
run('pnpm', ['--filter', '@payments/psp-adapter', 'db:migrate'], adapterEnv);

// Seeding stores provider credentials through psp-adapter, so it has to be up.
console.log('[prep] seeding (starting psp-adapter temporarily)');
const adapter = spawn('pnpm', ['--filter', '@payments/psp-adapter', 'dev'], {
	env: adapterEnv,
	stdio: 'ignore',
	detached: true,
});
const stopAdapter = () => {
	try {
		process.kill(-adapter.pid, 'SIGTERM');
	} catch { /* already gone */ }
};
process.on('exit', stopAdapter);

const adapterUrl = env.ADAPTER_URL ?? 'http://localhost:3001';
let up = false;
for (let i = 0; i < 60 && !up; i++) {
	up = await fetch(`${adapterUrl}/health`).then((r) => r.ok, () => false);
	if (!up) {
		await new Promise((r) => setTimeout(r, 1000));
	}
}
if (!up) {
	console.error('[prep] psp-adapter did not become healthy');
	process.exit(1);
}

const seed = spawnSync('pnpm', ['--filter', '@payments/payments-api', 'db:seed'], {
	env,
	encoding: 'utf8',
});
process.stdout.write(seed.stdout ?? '');
process.stderr.write(seed.stderr ?? '');
stopAdapter();
if (seed.status !== 0) {
	process.exit(seed.status ?? 1);
}

const apiKey = /API key \(save it\): (\S+)/.exec(seed.stdout)?.[1];
const shopEnv = readFileSync(SHOP_ENV, 'utf8');
if (apiKey) {
	const updated = shopEnv.replace(/^PAYMENTS_API_KEY=.*$/m, `PAYMENTS_API_KEY=${apiKey}`);
	writeFileSync(SHOP_ENV, updated);
	console.log(`[prep] wrote PAYMENTS_API_KEY to ${SHOP_ENV}`);
} else if (/^PAYMENTS_API_KEY=\s*$/m.test(shopEnv)) {
	console.warn(
		`[prep] project already seeded; set PAYMENTS_API_KEY in ${SHOP_ENV} manually `
		+ '(keys are only shown at creation)',
	);
}
console.log('[prep] done, run `pnpm run dev`');
