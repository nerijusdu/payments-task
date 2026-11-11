import PgBoss from 'pg-boss';
import { QUEUE_NAMES } from '@payments/contracts';
import type {
  EventQueue,
  PublishOptions,
  QueueMessage,
  QueueName,
  SubscribeOptions,
} from '@payments/contracts';

export interface PgBossQueueOptions {
  connectionString: string;
  /** Defaults to "pgboss". */
  schema?: string;
  /**
   * true: run pg-boss schema migrations and create queues (payments-api only).
   * false: publish/consume only, for a role without DDL rights (psp-adapter).
   */
  manageSchema: boolean;
}

/** Dedup window for `dedupKey` (pg-boss caps it at its 12h archive interval). DB unique constraints are the real guard. */
const DEDUP_WINDOW_SECONDS = 12 * 3600;

export class PgBossQueue implements EventQueue {
  private boss: PgBoss;

  constructor(private readonly opts: PgBossQueueOptions) {
    this.boss = new PgBoss({
      connectionString: opts.connectionString,
      schema: opts.schema ?? 'pgboss',
      migrate: opts.manageSchema,
      supervise: opts.manageSchema,
      schedule: false,
    });
  }

  async start(): Promise<void> {
    await this.boss.start();
    if (this.opts.manageSchema) {
      for (const name of QUEUE_NAMES) await this.boss.createQueue(name);
    }
  }

  async stop(): Promise<void> {
    await this.boss.stop({ graceful: true });
  }

  async publish<T>(
    queue: QueueName,
    payload: T,
    opts: PublishOptions = {},
  ): Promise<string | null> {
    const sendOpts: PgBoss.SendOptions = {};
    if (opts.dedupKey) {
      sendOpts.singletonKey = opts.dedupKey;
      sendOpts.singletonSeconds = DEDUP_WINDOW_SECONDS;
    }
    if (opts.delaySeconds !== undefined) sendOpts.startAfter = opts.delaySeconds;
    if (opts.retryLimit !== undefined) sendOpts.retryLimit = opts.retryLimit;
    if (opts.retryBackoff !== undefined) sendOpts.retryBackoff = opts.retryBackoff;
    return this.boss.send(queue, payload as object, sendOpts);
  }

  async subscribe<T>(
    queue: QueueName,
    handler: (msg: QueueMessage<T>) => Promise<void>,
    opts: SubscribeOptions = {},
  ): Promise<void> {
    await this.boss.work<T>(
      queue,
      {
        batchSize: opts.concurrency ?? 1,
        pollingIntervalSeconds: opts.pollingIntervalSeconds ?? 2,
        includeMetadata: true,
      },
      async (jobs) => {
        // A rejected handler fails the whole batch; pg-boss then retries it.
        await Promise.all(
          jobs.map((job) =>
            handler({ id: job.id, data: job.data, attempt: (job.retryCount ?? 0) + 1 }),
          ),
        );
      },
    );
  }
}
