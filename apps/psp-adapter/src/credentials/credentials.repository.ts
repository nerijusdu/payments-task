import { and, eq } from 'drizzle-orm';
import type { Db } from '../shared/db/client.js';
import { providerCredentials } from '../shared/db/schema.js';

export type StoredCredentials = typeof providerCredentials.$inferSelect;

export interface CredentialsKey {
	projectId: string;
	providerCode: string;
}

export interface CredentialsValues {
	credentials: string;
	webhookSecret: string | null;
	keyVersion: number;
}

export class CredentialsRepository {
	constructor(private readonly db: Db) { }

	/** Idempotent upsert; `rotated_at` is set when an existing row is replaced. */
	async upsert(key: CredentialsKey, values: CredentialsValues): Promise<void> {
		await this.db
			.insert(providerCredentials)
			.values({ ...key, ...values })
			.onConflictDoUpdate({
				target: [providerCredentials.projectId, providerCredentials.providerCode],
				set: { ...values, rotatedAt: new Date() },
			});
	}

	async find(key: CredentialsKey): Promise<StoredCredentials | null> {
		const [row] = await this.db
			.select()
			.from(providerCredentials)
			.where(and(
				eq(providerCredentials.projectId, key.projectId),
				eq(providerCredentials.providerCode, key.providerCode),
			))
			.limit(1);
		return row ?? null;
	}

	async delete(key: CredentialsKey): Promise<void> {
		await this.db
			.delete(providerCredentials)
			.where(and(
				eq(providerCredentials.projectId, key.projectId),
				eq(providerCredentials.providerCode, key.providerCode),
			));
	}
}
