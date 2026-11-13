import { and, desc, eq } from 'drizzle-orm';
import type { PaymentStatus } from '@payments/contracts';
import type { Db } from '../shared/db/client.js';
import { customers, paymentsTable, projects, providers } from '../shared/db/schema.js';

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
		providerId?: string;
		providerPaymentId?: string;
	}): Promise<Payment | null> {
		const [row] = await this.db
			.select()
			.from(paymentsTable)
			.where(and(
				eq(paymentsTable.projectId, query.projectId),
				query.id === undefined
					? undefined
					: eq(paymentsTable.id, query.id),
				query.idempotencyKey === undefined
					? undefined
					: eq(paymentsTable.idempotencyKey, query.idempotencyKey),
				query.providerId === undefined
					? undefined
					: eq(paymentsTable.providerId, query.providerId),
				query.providerPaymentId === undefined
					? undefined
					: eq(paymentsTable.providerPaymentId, query.providerPaymentId),
			))
			.limit(1);
		return row ?? null;
	}

	async list(filter: {
		projectId?: string;
		status?: PaymentStatus;
		limit: number;
		offset: number;
	}) {
		return this.db
			.select({
				id: paymentsTable.id,
				projectId: paymentsTable.projectId,
				projectName: projects.name,
				providerCode: providers.code,
				customerRef: customers.externalRef,
				customerEmail: customers.email,
				amount: paymentsTable.amount,
				currency: paymentsTable.currency,
				status: paymentsTable.status,
				providerPaymentId: paymentsTable.providerPaymentId,
				subscriptionId: paymentsTable.subscriptionId,
				metadata: paymentsTable.metadata,
				createdAt: paymentsTable.createdAt,
			})
			.from(paymentsTable)
			.innerJoin(projects, eq(projects.id, paymentsTable.projectId))
			.innerJoin(providers, eq(providers.id, paymentsTable.providerId))
			.innerJoin(customers, eq(customers.id, paymentsTable.customerId))
			.where(and(
				filter.projectId === undefined
					? undefined
					: eq(paymentsTable.projectId, filter.projectId),
				filter.status === undefined ? undefined : eq(paymentsTable.status, filter.status),
			))
			.orderBy(desc(paymentsTable.createdAt))
			.limit(filter.limit)
			.offset(filter.offset);
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
