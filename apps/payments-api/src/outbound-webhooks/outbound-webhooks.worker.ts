import { OutboundWebhooksMessage } from '@payments/contracts';
import type { EventQueue } from '@payments/contracts';
import type { OutboundWebhooksService } from './outbound-webhooks.service.js';

export async function startOutboundWebhooksWorker(
	queue: EventQueue,
	service: OutboundWebhooksService,
): Promise<void> {
	await queue.subscribe<unknown>('outbound-webhooks', async (msg) => {
		const { outboundWebhookId } = OutboundWebhooksMessage.parse(msg.data);
		await service.deliver(outboundWebhookId, msg.attempt);
	});
}
