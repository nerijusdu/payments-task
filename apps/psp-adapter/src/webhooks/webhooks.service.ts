import type { EventQueue, WebhookEventsMessage } from '@payments/contracts';
import { AppError } from '@payments/http';
import type { CredentialsService } from '../credentials/credentials.service.js';
import type { ProviderRegistry } from '../providers/provider-registry.js';

export class WebhooksService {
	constructor(
		private readonly registry: ProviderRegistry,
		private readonly credentials: CredentialsService,
		private readonly queue: EventQueue,
	) { }

	/** Verifies, normalizes and publishes. Throws 401 on a bad signature, publishing nothing. */
	async handle(input: {
		providerCode: string;
		projectId: string;
		rawBody: Buffer;
		headers: Record<string, string | string[] | undefined>;
	}): Promise<void> {
		const provider = this.registry.get(input.providerCode);
		const key = { projectId: input.projectId, providerCode: input.providerCode };
		if (!await this.credentials.exists(key)) {
			throw AppError.unauthorized('Invalid webhook signature');
		}
		const { webhookSecret } = await this.credentials.load(key);
		const event = provider.parseWebhook({
			projectId: input.projectId,
			rawBody: input.rawBody,
			headers: input.headers,
			webhookSecret,
		});
		if (!event) {
			return;
		}

		const message: WebhookEventsMessage = { event };
		await this.queue.publish('webhook-events', message, {
			dedupKey: `${event.providerCode}:${event.providerEventId}`,
			retryLimit: 5,
			retryBackoff: true,
		});
	}
}
