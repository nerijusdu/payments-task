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
}
