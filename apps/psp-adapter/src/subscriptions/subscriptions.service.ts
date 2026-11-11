import type {
	AdapterCancelSubscriptionRequest,
	AdapterCreateSubscriptionRequest,
	AdapterSubscriptionResponse,
} from '@payments/contracts';
import type { CredentialsService } from '../credentials/credentials.service.js';
import type { ProviderRegistry } from '../providers/provider-registry.js';

export class SubscriptionsService {
	constructor(
		private readonly registry: ProviderRegistry,
		private readonly credentials: CredentialsService,
	) {}

	async create(
		providerCode: string,
		req: AdapterCreateSubscriptionRequest,
		idempotencyKey?: string,
	): Promise<AdapterSubscriptionResponse> {
		const provider = this.registry.get(providerCode);
		const { credentials } = await this.credentials.load({
			projectId: req.projectId,
			providerCode,
		});
		return provider.createSubscription({ credentials, idempotencyKey }, req);
	}

	async cancel(
		providerCode: string,
		providerSubscriptionId: string,
		req: AdapterCancelSubscriptionRequest,
		idempotencyKey?: string,
	): Promise<AdapterSubscriptionResponse> {
		const provider = this.registry.get(providerCode);
		const { credentials } = await this.credentials.load({
			projectId: req.projectId,
			providerCode,
		});
		return provider.cancelSubscription(
			{ credentials, idempotencyKey },
			providerSubscriptionId,
			req,
		);
	}
}
