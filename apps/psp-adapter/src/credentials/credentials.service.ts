import { credentialsNotFound } from '../shared/errors/adapter-errors.js';
import type { CredentialEnvelope } from '../providers/payment-provider.js';
import type { CredentialCipher } from '../shared/crypto/credential-cipher.js';
import type { CredentialsKey, CredentialsRepository } from './credentials.repository.js';

export class CredentialsService {
	constructor(
		private readonly repository: CredentialsRepository,
		private readonly cipher: CredentialCipher,
	) {}

	async save(
		key: CredentialsKey,
		input: { credentials: Record<string, unknown>; webhookSecret?: string },
	): Promise<void> {
		const encrypted = this.cipher.encrypt(JSON.stringify(input.credentials));
		const webhookSecret = input.webhookSecret === undefined
			? null
			: this.cipher.encrypt(input.webhookSecret).ciphertext;
		await this.repository.upsert(key, {
			credentials: encrypted.ciphertext,
			webhookSecret,
			keyVersion: encrypted.keyVersion,
		});
	}

	async delete(key: CredentialsKey): Promise<void> {
		await this.repository.delete(key);
	}

	async exists(key: CredentialsKey): Promise<boolean> {
		return (await this.repository.find(key)) !== null;
	}

	/** Decrypts for in-process use only; never exposed through a controller. */
	async load(key: CredentialsKey): Promise<CredentialEnvelope> {
		const row = await this.repository.find(key);
		if (!row) {
			throw credentialsNotFound(key.projectId, key.providerCode);
		}
		const decrypt = (ciphertext: string) =>
			this.cipher.decrypt({ ciphertext, keyVersion: row.keyVersion });
		return {
			credentials: JSON.parse(decrypt(row.credentials)) as Record<string, unknown>,
			webhookSecret: row.webhookSecret ? decrypt(row.webhookSecret) : undefined,
		};
	}
}
