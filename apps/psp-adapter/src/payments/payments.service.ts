import type { AdapterCreatePaymentRequest, AdapterPaymentResponse } from '@payments/contracts';
import type { CredentialsService } from '../credentials/credentials.service.js';
import type { ProviderRegistry } from '../providers/provider-registry.js';

export class PaymentsService {
	constructor(
		private readonly registry: ProviderRegistry,
		private readonly credentials: CredentialsService,
	) {}

	async create(
		providerCode: string,
		req: AdapterCreatePaymentRequest,
		idempotencyKey?: string,
	): Promise<AdapterPaymentResponse> {
		const provider = this.registry.get(providerCode);
		const { credentials } = await this.credentials.load({
			projectId: req.projectId,
			providerCode,
		});
		return provider.createPayment({ credentials, idempotencyKey }, req);
	}
}
