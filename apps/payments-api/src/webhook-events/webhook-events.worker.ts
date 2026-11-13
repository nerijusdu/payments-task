import { WebhookEventsMessage } from '@payments/contracts';
import type { EventQueue } from '@payments/contracts';
import type { WebhookEventsService } from './webhook-events.service.js';

export async function startWebhookEventsWorker(
	queue: EventQueue,
	service: WebhookEventsService,
): Promise<void> {
	await queue.subscribe<unknown>('webhook-events', async (msg) => {
		const { event } = WebhookEventsMessage.parse(msg.data);
		await service.process(event);
	});
}
