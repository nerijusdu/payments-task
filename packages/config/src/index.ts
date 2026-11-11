import { z } from 'zod';

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

/** Validates env vars against a Zod schema; throws one error listing every problem. */
export function loadConfig<S extends z.ZodTypeAny>(
	schema: S,
	env: Record<string, string | undefined> = process.env,
): z.infer<S> {
	const result = schema.safeParse(env);
	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
			.join('\n');
		throw new ConfigError(`Invalid environment configuration:\n${issues}`);
	}
	return result.data;
}

/** Reusable env field schemas shared by the apps. */
export const env = {
	nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
	port: (fallback: number) => z.coerce.number().int().min(1).max(65535).default(fallback),
	logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
	databaseUrl: z.string().url(),
	url: z.string().url(),
	secret: (minLength = 16) => z.string().min(minLength),
	queueDriver: z.enum(['pgboss', 'memory']).default('pgboss'),
};

/** Fields common to every service. */
export const baseConfigShape = {
	NODE_ENV: env.nodeEnv,
	LOG_LEVEL: env.logLevel,
};

/** Queue-related fields; spread into an app's config schema. */
export const queueConfigShape = {
	QUEUE_DRIVER: env.queueDriver,
	QUEUE_DATABASE_URL: z.string().url().optional(),
	QUEUE_SCHEMA: z.string().default('pgboss'),
};
