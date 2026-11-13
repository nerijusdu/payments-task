import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../shared/db/client.js';
import { customers, plans, projects, providers, subscriptions } from '../shared/db/schema.js';

export type Subscription = typeof subscriptions.$inferSelect;

export class SubscriptionsRepository {
	constructor(private readonly db: Db) { }

	/** Returns null when (projectId, idempotencyKey) already exists. */
	async insertIfAbsent(values: typeof subscriptions.$inferInsert): Promise<Subscription | null> {
		const [row] = await this.db
			.insert(subscriptions)
			.values(values)
			.onConflictDoNothing({
				target: [subscriptions.projectId, subscriptions.idempotencyKey],
			})
			.returning();
		return row ?? null;
	}

	async find(query: {
		projectId: string;
		id?: string;
		idempotencyKey?: string;
		providerId?: string;
		providerSubscriptionId?: string;
	}): Promise<Subscription | null> {
		const [row] = await this.db
			.select()
			.from(subscriptions)
			.where(and(
				eq(subscriptions.projectId, query.projectId),
				query.id === undefined ? undefined : eq(subscriptions.id, query.id),
				query.idempotencyKey === undefined
					? undefined
					: eq(subscriptions.idempotencyKey, query.idempotencyKey),
				query.providerId === undefined
					? undefined
					: eq(subscriptions.providerId, query.providerId),
				query.providerSubscriptionId === undefined
					? undefined
					: eq(subscriptions.providerSubscriptionId, query.providerSubscriptionId),
			))
			.limit(1);
		return row ?? null;
	}

	async list(filter: {
		projectId?: string;
		status?: Subscription['status'];
		limit: number;
		offset: number;
	}) {
		return this.db
			.select({
				id: subscriptions.id,
				projectId: subscriptions.projectId,
				projectName: projects.name,
				providerCode: providers.code,
				planCode: plans.code,
				planName: plans.name,
				customerRef: customers.externalRef,
				customerEmail: customers.email,
				amount: subscriptions.amount,
				currency: subscriptions.currency,
				status: subscriptions.status,
				providerSubscriptionId: subscriptions.providerSubscriptionId,
				currentPeriodStart: subscriptions.currentPeriodStart,
				currentPeriodEnd: subscriptions.currentPeriodEnd,
				cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
				canceledAt: subscriptions.canceledAt,
				createdAt: subscriptions.createdAt,
			})
			.from(subscriptions)
			.innerJoin(projects, eq(projects.id, subscriptions.projectId))
			.innerJoin(providers, eq(providers.id, subscriptions.providerId))
			.innerJoin(plans, eq(plans.id, subscriptions.planId))
			.innerJoin(customers, eq(customers.id, subscriptions.customerId))
			.where(and(
				filter.projectId === undefined
					? undefined
					: eq(subscriptions.projectId, filter.projectId),
				filter.status === undefined ? undefined : eq(subscriptions.status, filter.status),
			))
			.orderBy(desc(subscriptions.createdAt))
			.limit(filter.limit)
			.offset(filter.offset);
	}

	async update(
		id: string,
		patch: Partial<Pick<
			Subscription,
			| 'status'
			| 'providerSubscriptionId'
			| 'currentPeriodStart'
			| 'currentPeriodEnd'
			| 'cancelAtPeriodEnd'
			| 'canceledAt'
		>>,
	): Promise<Subscription> {
		const [row] = await this.db
			.update(subscriptions)
			.set(patch)
			.where(eq(subscriptions.id, id))
			.returning();
		return row!;
	}
}
