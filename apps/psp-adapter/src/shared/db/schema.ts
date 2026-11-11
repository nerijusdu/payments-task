import {
	integer, pgSchema, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

export const adapter = pgSchema('adapter');

/** Per-project PSP secrets. `project_id` is a plain identifier owned by payments-api. */
export const providerCredentials = adapter.table('provider_credentials', {
	id: uuid('id').primaryKey().defaultRandom(),
	projectId: text('project_id').notNull(),
	providerCode: text('provider_code').notNull(),
	credentials: text('credentials').notNull(),
	webhookSecret: text('webhook_secret'),
	keyVersion: integer('key_version').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	rotatedAt: timestamp('rotated_at', { withTimezone: true }),
}, (t) => [
	uniqueIndex('provider_credentials_project_provider_idx').on(t.projectId, t.providerCode),
]);
