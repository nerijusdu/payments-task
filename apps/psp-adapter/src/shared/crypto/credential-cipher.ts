import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedValue {
	ciphertext: string;
	keyVersion: number;
}

/** AES-256-GCM. Output layout (base64): iv(12) | authTag(16) | ciphertext. */
export class CredentialCipher {
	private readonly keys = new Map<number, Buffer>();

	/** `keys` maps version to a base64-encoded 32-byte key; `currentVersion` is used to encrypt. */
	constructor(keys: Record<number, string>, private readonly currentVersion: number) {
		for (const [version, key] of Object.entries(keys)) {
			const buf = Buffer.from(key, 'base64');
			if (buf.length !== 32) {
				throw new Error(`Encryption key v${version} must be 32 bytes`);
			}
			this.keys.set(Number(version), buf);
		}
		if (!this.keys.has(currentVersion)) {
			throw new Error(`No encryption key for version ${currentVersion}`);
		}
	}

	encrypt(plaintext: string): EncryptedValue {
		const iv = randomBytes(12);
		const cipher = createCipheriv('aes-256-gcm', this.keys.get(this.currentVersion)!, iv);
		const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
		const ciphertext = Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
		return { ciphertext, keyVersion: this.currentVersion };
	}

	decrypt(value: EncryptedValue): string {
		const key = this.keys.get(value.keyVersion);
		if (!key) {
			throw new Error(`No encryption key for version ${value.keyVersion}`);
		}
		const raw = Buffer.from(value.ciphertext, 'base64');
		const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
		decipher.setAuthTag(raw.subarray(12, 28));
		return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
	}
}
