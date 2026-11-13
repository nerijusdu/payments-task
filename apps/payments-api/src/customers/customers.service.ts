import type { CustomerRef } from '@payments/contracts';
import type { Customer, CustomersRepository } from './customers.repository.js';

export class CustomersService {
	constructor(private readonly repo: CustomersRepository) {}

	findOrCreate(projectId: string, ref: CustomerRef): Promise<Customer> {
		return this.repo.upsert(projectId, ref.externalRef, ref.email);
	}

	find(query: { projectId: string; externalRef?: string }): Promise<Customer | null> {
		return this.repo.find(query);
	}

	findProviderCustomerId(customerId: string, providerId: string): Promise<string | null> {
		return this.repo.findProviderCustomerId(customerId, providerId);
	}

	/** Remembers the PSP-side id the first time the adapter reports one. */
	async saveProviderCustomerId(
		customerId: string,
		providerId: string,
		providerCustomerId: string,
	): Promise<void> {
		if (await this.repo.findProviderCustomerId(customerId, providerId)) {
			return;
		}
		await this.repo.insertProviderCustomer(customerId, providerId, providerCustomerId);
	}
}
