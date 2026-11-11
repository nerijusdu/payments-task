import { and, eq } from 'drizzle-orm';
import type { Db } from '../shared/db/client.js';
import { customers, providerCustomers } from '../shared/db/schema.js';

export type Customer = typeof customers.$inferSelect;

export class CustomersRepository {
	constructor(private readonly db: Db) { }

	async upsert(projectId: string, externalRef: string, email?: string): Promise<Customer> {
		const [row] = await this.db
			.insert(customers)
			.values({ projectId, externalRef, email })
			.onConflictDoUpdate({
				target: [customers.projectId, customers.externalRef],
				// Keep the stored email when the caller does not send one.
				set: { email: email ?? undefined, externalRef },
			})
			.returning();
		return row!;
	}

	async find(query: { projectId: string; externalRef?: string }): Promise<Customer | null> {
		const [row] = await this.db
			.select()
			.from(customers)
			.where(and(
				eq(customers.projectId, query.projectId),
				query.externalRef === undefined
					? undefined
					: eq(customers.externalRef, query.externalRef),
			))
			.limit(1);
		return row ?? null;
	}

	async findProviderCustomerId(customerId: string, providerId: string): Promise<string | null> {
		const [row] = await this.db
			.select()
			.from(providerCustomers)
			.where(and(
				eq(providerCustomers.customerId, customerId),
				eq(providerCustomers.providerId, providerId),
			))
			.limit(1);
		return row?.providerCustomerId ?? null;
	}

	async insertProviderCustomer(
		customerId: string,
		providerId: string,
		providerCustomerId: string,
	): Promise<void> {
		await this.db
			.insert(providerCustomers)
			.values({ customerId, providerId, providerCustomerId });
	}
}
