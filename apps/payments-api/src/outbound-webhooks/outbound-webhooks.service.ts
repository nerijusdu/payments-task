import { createHmac, randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { EventQueue, OutboundEventType, OutboundWebhooksMessage } from '@payments/contracts';
import type { ProjectsService } from '../projects/projects.service.js';
import type { OutboundWebhooksRepository } from './outbound-webhooks.repository.js';

export const MAX_DELIVERY_ATTEMPTS = 8;
const DELIVERY_TIMEOUT_MS = 10_000;

export const signPayload = (secret: string, timestamp: number, body: string) =>
	createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

export class OutboundWebhooksService {
	constructor(
		private readonly repo: OutboundWebhooksRepository,
		private readonly projects: ProjectsService,
		private readonly queue: EventQueue,
		private readonly logger: Logger,
	) { }

	/** Records the event and queues its delivery. No-op when the project has no webhook URL. */
	async enqueue(
		projectId: string,
		eventType: OutboundEventType,
		data: Record<string, unknown>,
	): Promise<void> {
		const project = await this.projects.findById(projectId);
		if (!project?.webhookUrl) {
			return;
		}
		const eventId = randomUUID();
		const row = await this.repo.insert({
			projectId,
			eventType,
			payload: { id: eventId, type: eventType, createdAt: new Date().toISOString(), data },
			status: 'pending',
		});
		const message: OutboundWebhooksMessage = { outboundWebhookId: row.id };
		await this.queue.publish('outbound-webhooks', message, {
			dedupKey: row.id,
			retryLimit: MAX_DELIVERY_ATTEMPTS - 1,
			retryBackoff: true,
		});
	}

	/**
	 * Idempotent: delivered rows are skipped. Throws on failure so the queue retries; on the
	 * last attempt the row is marked failed and the message is dropped.
	 */
	async deliver(outboundWebhookId: string, attempt: number): Promise<void> {
		const row = await this.repo.find(outboundWebhookId);
		if (!row || row.status === 'delivered') {
			return;
		}
		const final = attempt >= MAX_DELIVERY_ATTEMPTS;
		const project = await this.projects.findById(row.projectId);
		if (!project?.webhookUrl) {
			await this.repo.markAttemptFailed(row.id, 'Project has no webhook URL', true);
			return;
		}

		const body = JSON.stringify(row.payload);
		const timestamp = Math.floor(Date.now() / 1000);
		try {
			const res = await fetch(project.webhookUrl, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-webhook-id': row.id,
					'x-webhook-timestamp': String(timestamp),
					'x-webhook-signature': `v1=${signPayload(project.webhookSecret, timestamp, body)}`,
				},
				body,
				redirect: 'manual',
				signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
			});
			if (!res.ok) {
				throw new Error(`Endpoint responded ${res.status}`);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await this.repo.markAttemptFailed(row.id, message, final);
			this.logger.warn({ outboundWebhookId: row.id, attempt, final }, `webhook delivery failed: ${message}`);
			if (final) {
				return;
			}
			throw err;
		}
		await this.repo.markDelivered(row.id);
	}
}
