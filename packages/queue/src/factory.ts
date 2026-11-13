import type { EventQueue } from '@payments/contracts';
import { InMemoryQueue } from './in-memory-queue.js';
import { PgBossQueue } from './pg-boss-queue.js';

export interface CreateQueueOptions {
	driver: 'pgboss' | 'memory';
	connectionString?: string;
	schema?: string;
	manageSchema?: boolean;
}

export function createEventQueue(opts: CreateQueueOptions): EventQueue {
	if (opts.driver === 'memory') {
		return new InMemoryQueue();
	}
	if (!opts.connectionString) {
		throw new Error('connectionString is required for the pgboss queue driver');
	}
	return new PgBossQueue({
		connectionString: opts.connectionString,
		schema: opts.schema,
		manageSchema: opts.manageSchema ?? false,
	});
}
