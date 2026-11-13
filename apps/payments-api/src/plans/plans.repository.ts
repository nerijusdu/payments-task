import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../shared/db/client.js';
import { planProviderMappings, plans, providers } from '../shared/db/schema.js';

export type Plan = typeof plans.$inferSelect;

export class PlansRepository {
	constructor(private readonly db: Db) {}

	/** Inserts the plan and its provider mappings atomically. */
	async insert(
		values: typeof plans.$inferInsert,
		mappings: { providerId: string; providerPriceId: string }[],
	): Promise<Plan> {
		return this.db.transaction(async (tx) => {
			const [plan] = await tx.insert(plans).values(values).returning();
			if (mappings.length > 0) {
				await tx.insert(planProviderMappings).values(
					mappings.map((m) => ({ planId: plan!.id, ...m })),
				);
			}
			return plan!;
		});
	}

	async list(projectId: string) {
		const rows = await this.db
			.select({ plan: plans, providerCode: providers.code, providerPriceId: planProviderMappings.providerPriceId })
			.from(plans)
			.leftJoin(planProviderMappings, eq(planProviderMappings.planId, plans.id))
			.leftJoin(providers, eq(providers.id, planProviderMappings.providerId))
			.where(eq(plans.projectId, projectId))
			.orderBy(asc(plans.createdAt));
		const byId = new Map<string, Plan & { providerMappings: { providerCode: string; providerPriceId: string }[] }>();
		for (const r of rows) {
			const entry = byId.get(r.plan.id) ?? { ...r.plan, providerMappings: [] };
			if (r.providerCode && r.providerPriceId) {
				entry.providerMappings.push({ providerCode: r.providerCode, providerPriceId: r.providerPriceId });
			}
			byId.set(r.plan.id, entry);
		}
		return [...byId.values()];
	}

	async find(query: { projectId: string; id?: string; code?: string }): Promise<Plan | null> {
		const [row] = await this.db
			.select()
			.from(plans)
			.where(and(
				eq(plans.projectId, query.projectId),
				query.id === undefined ? undefined : eq(plans.id, query.id),
				query.code === undefined ? undefined : eq(plans.code, query.code),
			))
			.limit(1);
		return row ?? null;
	}

	async findProviderPriceId(planId: string, providerId: string): Promise<string | null> {
		const [row] = await this.db
			.select()
			.from(planProviderMappings)
			.where(and(
				eq(planProviderMappings.planId, planId),
				eq(planProviderMappings.providerId, providerId),
			));
		return row?.providerPriceId ?? null;
	}
}
