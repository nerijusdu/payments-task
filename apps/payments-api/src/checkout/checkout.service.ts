import type { CheckoutProvidersQuery, CheckoutProvidersResponseDto } from '@payments/contracts';
import type { ProjectsService } from '../projects/projects.service.js';

export class CheckoutService {
	constructor(private readonly projects: ProjectsService) { }

	/** Enabled providers for the project, in configured order, supporting the currency. */
	async listProviders(
		projectId: string,
		query: CheckoutProvidersQuery,
	): Promise<CheckoutProvidersResponseDto> {
		const rows = await this.projects.listEnabledProviders(projectId);
		return {
			providers: rows
				.filter((r) => !query.currency
					|| r.currencies.length === 0
					|| r.currencies.includes(query.currency))
				.map((r) => ({ code: r.providerCode, name: r.providerName, methods: r.supportedMethods })),
		};
	}
}
