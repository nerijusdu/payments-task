import { and, eq } from 'drizzle-orm';
import type { Db } from '../shared/db/client.js';
import { webhookEvents } from '../shared/db/schema.js';

export type WebhookEventRow = typeof webhookEvents.$inferSelect;

export class WebhookEventsRepository {
	constructor(private readonly db: Db) { }

	/** Returns null when (providerId, providerEventId) was already recorded. */
	async insertIfAbsent(values: typeof webhookEvents.$inferInsert): Promise<WebhookEventRow | null> {
		const [row] = await this.db
			.insert(webhookEvents)
			.values(values)
			.onConflictDoNothing({
				target: [webhookEvents.providerId, webhookEvents.providerEventId],
			})
			.returning();
		return row ?? null;
	}

	async find(providerId: string, providerEventId: string): Promise<WebhookEventRow | null> {
		const [row] = await this.db
			.select()
			.from(webhookEvents)
			.where(and(
				eq(webhookEvents.providerId, providerId),
				eq(webhookEvents.providerEventId, providerEventId),
			))
			.limit(1);
		return row ?? null;
	}

	async markProcessed(id: string): Promise<void> {
		await this.db
			.update(webhookEvents)
			.set({ status: 'processed', processedAt: new Date(), error: null })
			.where(eq(webhookEvents.id, id));
	}

	async markFailed(id: string, error: string): Promise<void> {
		await this.db
			.update(webhookEvents)
			.set({ status: 'failed', processedAt: new Date(), error })
			.where(eq(webhookEvents.id, id));
	}
}
