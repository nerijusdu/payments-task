// Starts all apps. Run `pnpm run prep` first.
import { spawn } from 'node:child_process';
import { loadEnv } from './env.mjs';

const { env, adapterEnv } = loadEnv();

const apps = [
	['payments-api', 'pnpm', ['--filter', '@payments/payments-api', 'dev'], env],
	['psp-adapter', 'pnpm', ['--filter', '@payments/psp-adapter', 'dev'], adapterEnv],
	['admin-ui', 'pnpm', ['--filter', '@payments/admin-ui', 'dev'], env],
	['shop', 'npm', ['--prefix', 'examples/shop', 'run', 'dev'], env],
];
const children = apps.map(([label, cmd, args, childEnv]) => {
	const child = spawn(cmd, args, { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
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
