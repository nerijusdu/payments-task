import { and, eq } from 'drizzle-orm';
import type { PaymentStatus } from '@payments/contracts';
import type { Db } from '../shared/db/client.js';
import { paymentsTable } from '../shared/db/schema.js';

export type Payment = typeof paymentsTable.$inferSelect;

export class PaymentsRepository {
	constructor(private readonly db: Db) { }

	/** Returns null when (projectId, idempotencyKey) already exists. */
	async insertIfAbsent(values: typeof paymentsTable.$inferInsert): Promise<Payment | null> {
		const [row] = await this.db
			.insert(paymentsTable)
			.values(values)
			.onConflictDoNothing({
				target: [paymentsTable.projectId, paymentsTable.idempotencyKey],
			})
			.returning();
		return row ?? null;
	}

	async find(query: {
		projectId: string;
		id?: string;
		idempotencyKey?: string;
	}): Promise<Payment | null> {
		const [row] = await this.db
			.select()
			.from(paymentsTable)
			.where(and(
				eq(paymentsTable.projectId, query.projectId),
				query.id === undefined ? undefined : eq(paymentsTable.id, query.id),
				query.idempotencyKey === undefined
					? undefined
					: eq(paymentsTable.idempotencyKey, query.idempotencyKey),
			))
			.limit(1);
		return row ?? null;
	}

	/** Compare-and-set on the current status so concurrent writers cannot skip the state machine. */
	async updateStatus(
		id: string,
		from: PaymentStatus,
		to: PaymentStatus,
		providerPaymentId?: string,
	): Promise<Payment | null> {
		const [row] = await this.db
			.update(paymentsTable)
			.set({ status: to, providerPaymentId })
			.where(and(eq(paymentsTable.id, id), eq(paymentsTable.status, from)))
			.returning();
		return row ?? null;
	}
}
