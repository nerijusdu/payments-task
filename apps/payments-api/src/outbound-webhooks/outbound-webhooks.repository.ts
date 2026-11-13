import { eq, sql } from 'drizzle-orm';
import type { Db } from '../shared/db/client.js';
import { outboundWebhooks } from '../shared/db/schema.js';

export type OutboundWebhook = typeof outboundWebhooks.$inferSelect;

export class OutboundWebhooksRepository {
	constructor(private readonly db: Db) { }

	async insert(values: typeof outboundWebhooks.$inferInsert): Promise<OutboundWebhook> {
		const [row] = await this.db.insert(outboundWebhooks).values(values).returning();
		return row!;
	}

	async find(id: string): Promise<OutboundWebhook | null> {
		const [row] = await this.db
			.select()
			.from(outboundWebhooks)
			.where(eq(outboundWebhooks.id, id))
			.limit(1);
		return row ?? null;
	}

	async markAttemptFailed(id: string, error: string, final: boolean): Promise<void> {
		await this.db
			.update(outboundWebhooks)
			.set({
				attempts: sql`${outboundWebhooks.attempts} + 1`,
				lastError: error,
				status: final ? 'failed' : 'pending',
			})
			.where(eq(outboundWebhooks.id, id));
	}

	async markDelivered(id: string): Promise<void> {
		await this.db
			.update(outboundWebhooks)
			.set({
				attempts: sql`${outboundWebhooks.attempts} + 1`,
				status: 'delivered',
				deliveredAt: new Date(),
				lastError: null,
			})
			.where(eq(outboundWebhooks.id, id));
	}
}
