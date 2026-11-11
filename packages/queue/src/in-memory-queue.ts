import { randomUUID } from 'node:crypto';
import type {
	EventQueue,
	PublishOptions,
	QueueMessage,
	QueueName,
	SubscribeOptions,
} from '@payments/contracts';

type Handler = (msg: QueueMessage<unknown>) => Promise<void>;
interface Job {
	msg: QueueMessage<unknown>;
	opts: PublishOptions;
}

/** Process-local queue for local dev and tests. No persistence. */
export class InMemoryQueue implements EventQueue {
	private handlers = new Map<QueueName, Handler>();
	private pending = new Map<QueueName, Job[]>();
	private seenKeys = new Set<string>();
	private timers = new Set<NodeJS.Timeout>();
	private started = false;

	async publish<T>(
		queue: QueueName,
		payload: T,
		opts: PublishOptions = {},
	): Promise<string | null> {
		if (opts.dedupKey) {
			const key = `${queue}:${opts.dedupKey}`;
			if (this.seenKeys.has(key)) return null;
			this.seenKeys.add(key);
		}
		const msg: QueueMessage<unknown> = { id: randomUUID(), data: payload, attempt: 1 };
		this.enqueue(queue, { msg, opts }, (opts.delaySeconds ?? 0) * 1000);
		return msg.id;
	}

	async subscribe<T>(
		queue: QueueName,
		handler: (msg: QueueMessage<T>) => Promise<void>,
		_opts?: SubscribeOptions,
	): Promise<void> {
		this.handlers.set(queue, handler as Handler);
		if (this.started) this.drain(queue);
	}

	async start(): Promise<void> {
		this.started = true;
		for (const queue of [...this.pending.keys()]) this.drain(queue);
	}

	async stop(): Promise<void> {
		this.started = false;
		for (const t of this.timers) clearTimeout(t);
		this.timers.clear();
	}

	private enqueue(queue: QueueName, job: Job, delayMs: number) {
		const push = () => {
			const list = this.pending.get(queue) ?? [];
			list.push(job);
			this.pending.set(queue, list);
			if (this.started) this.drain(queue);
		};
		if (delayMs <= 0) return push();
		const timer = setTimeout(() => {
			this.timers.delete(timer);
			push();
		}, delayMs);
		this.timers.add(timer);
	}

	private drain(queue: QueueName) {
		const handler = this.handlers.get(queue);
		const jobs = this.pending.get(queue);
		if (!handler || !jobs?.length) return;
		this.pending.set(queue, []);
		for (const job of jobs) void this.run(queue, handler, job);
	}

	private async run(queue: QueueName, handler: Handler, job: Job) {
		try {
			await handler(job.msg);
		} catch {
			const { msg, opts } = job;
			if (msg.attempt > (opts.retryLimit ?? 0)) return;
			const delaySeconds = opts.retryBackoff ? 2 ** msg.attempt : 1;
			this.enqueue(
				queue,
				{ msg: { ...msg, attempt: msg.attempt + 1 }, opts },
				delaySeconds * 1000,
			);
		}
	}
}
