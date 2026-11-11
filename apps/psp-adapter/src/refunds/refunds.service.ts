import type { AdapterRefundRequest, AdapterRefundResponse } from '@payments/contracts';
import type { CredentialsService } from '../credentials/credentials.service.js';
import type { ProviderRegistry } from '../providers/provider-registry.js';

export class RefundsService {
	constructor(
		private readonly registry: ProviderRegistry,
		private readonly credentials: CredentialsService,
	) {}

	async create(
		providerCode: string,
		providerPaymentId: string,
		req: AdapterRefundRequest,
		idempotencyKey?: string,
	): Promise<AdapterRefundResponse> {
		const provider = this.registry.get(providerCode);
		const { credentials } = await this.credentials.load({
			projectId: req.projectId,
			providerCode,
		});
		return provider.refund({ credentials, idempotencyKey }, providerPaymentId, req);
	}
}
