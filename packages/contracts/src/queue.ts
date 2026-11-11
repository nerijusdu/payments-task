export type QueueName = 'webhook-events' | 'outbound-webhooks';

export const QUEUE_NAMES: readonly QueueName[] = ['webhook-events', 'outbound-webhooks'];

export interface PublishOptions {
	/** Messages with the same key on the same queue are published once. */
	dedupKey?: string;
	delaySeconds?: number;
	retryLimit?: number;
	retryBackoff?: boolean;
}

export interface SubscribeOptions {
	/** Max messages processed in parallel. */
	concurrency?: number;
	pollingIntervalSeconds?: number;
}

export interface QueueMessage<T> {
	id: string;
	data: T;
	/** 1-based delivery attempt. */
	attempt: number;
}

/**
 * Delivery is at-least-once: handlers must be idempotent.
 * A handler that throws causes a retry according to the publish options.
 */
export interface EventQueue {
	/** Returns the message id, or null if deduplicated. */
	publish<T>(queue: QueueName, payload: T, opts?: PublishOptions): Promise<string | null>;
	subscribe<T>(
		queue: QueueName,
		handler: (msg: QueueMessage<T>) => Promise<void>,
		opts?: SubscribeOptions,
	): Promise<void>;
	start(): Promise<void>;
	stop(): Promise<void>;
}
