import type { Logger } from 'pino';
import type { NormalizedWebhookEvent, PaymentStatus } from '@payments/contracts';
import { AppError } from '@payments/http';
import type { PaymentsService } from '../payments/payments.service.js';
import type { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { WebhookEventsRepository } from './webhook-events.repository.js';

export class WebhookEventsService {
	constructor(
		private readonly repo: WebhookEventsRepository,
		private readonly projects: ProjectsService,
		private readonly payments: PaymentsService,
		private readonly subscriptions: SubscriptionsService,
		private readonly logger: Logger,
	) { }

	/**
	 * Idempotent: a replayed event that was already processed is skipped, one that is still
	 * "received" or "failed" is applied again. Throwing means "retry later".
	 */
	async process(event: NormalizedWebhookEvent): Promise<void> {
		const provider = await this.projects.findProvider({ code: event.providerCode });
		if (!provider) {
			throw AppError.notFound(`Unknown provider: ${event.providerCode}`);
		}

		const row = await this.repo.insertIfAbsent({
			providerId: provider.id,
			providerEventId: event.providerEventId,
			payload: event,
			status: 'received',
		}) ?? await this.repo.find(provider.id, event.providerEventId);
		if (!row) {
			throw new AppError('INTERNAL_ERROR', 500, 'Webhook event could not be recorded');
		}
		if (row.status === 'processed') {
			return;
		}

		try {
			await this.apply(event, provider.id);
		} catch (err) {
			if (err instanceof AppError && err.code === 'INVALID_STATE_TRANSITION' && err.status === 409
				&& err.message.startsWith('Cannot move')) {
				// Out-of-order or stale event: retrying cannot help.
				await this.repo.markFailed(row.id, err.message);
				this.logger.warn({ eventId: event.providerEventId }, err.message);
				return;
			}
			await this.repo.markFailed(row.id, err instanceof Error ? err.message : String(err));
			throw err;
		}
		await this.repo.markProcessed(row.id);
	}

	private async apply(event: NormalizedWebhookEvent, providerId: string): Promise<void> {
		switch (event.type) {
			case 'payment.updated':
				await this.payments.applyProviderStatus(
					event.projectId,
					providerId,
					event.providerObjectId,
					event.status as PaymentStatus,
				);
				return;
			case 'subscription.updated':
			case 'subscription.renewed':
				await this.subscriptions.applyProviderEvent(providerId, event);
				return;
			default:
				// Refund events are handled once that feature exists.
				this.logger.info({ type: event.type }, 'webhook event type not handled yet');
		}
	}
}
