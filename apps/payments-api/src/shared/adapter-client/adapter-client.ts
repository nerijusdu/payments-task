import {
	AdapterPaymentResponse,
	CORRELATION_ID_HEADER,
	CredentialsStatusResponse,
	ErrorResponse,
} from '@payments/contracts';
import type {
	AdapterCreatePaymentRequest,
	SaveCredentialsRequest,
} from '@payments/contracts';
import { AppError } from '@payments/http';

export interface AdapterClientOptions {
	baseUrl: string;
	serviceToken: string;
	timeoutMs?: number;
	/** Extra attempts after the first one, on network errors and 5xx only. */
	retries?: number;
}

interface CallOptions {
	method: 'POST' | 'PUT' | 'DELETE' | 'GET';
	path: string;
	body?: unknown;
	idempotencyKey?: string;
	correlationId?: string;
}

/**
 * HTTP client for psp-adapter. Only used for calls that are safe to repeat:
 * payment creation carries an idempotency key and credential saves are upserts.
 * Request bodies are never logged: credential payloads pass through here.
 */
export class AdapterClient {
	private readonly timeoutMs: number;
	private readonly retries: number;

	constructor(private readonly options: AdapterClientOptions) {
		this.timeoutMs = options.timeoutMs ?? 10_000;
		this.retries = options.retries ?? 2;
	}

	async createPayment(
		providerCode: string,
		req: AdapterCreatePaymentRequest,
		opts: { idempotencyKey: string; correlationId?: string },
	): Promise<AdapterPaymentResponse> {
		const json = await this.call({
			method: 'POST',
			path: `/v1/${encodeURIComponent(providerCode)}/payments`,
			body: req,
			...opts,
		});
		const parsed = AdapterPaymentResponse.safeParse(json);
		if (!parsed.success) {
			throw new AppError('PROVIDER_ERROR', 502, 'Invalid response from psp-adapter');
		}
		return parsed.data;
	}

	async saveCredentials(
		projectId: string,
		providerCode: string,
		body: SaveCredentialsRequest,
	): Promise<void> {
		await this.call({ method: 'PUT', path: credentialsPath(projectId, providerCode), body });
	}

	async deleteCredentials(projectId: string, providerCode: string): Promise<void> {
		await this.call({ method: 'DELETE', path: credentialsPath(projectId, providerCode) });
	}

	async credentialsExist(projectId: string, providerCode: string): Promise<boolean> {
		const json = await this.call({
			method: 'GET',
			path: `${credentialsPath(projectId, providerCode)}/status`,
		});
		return CredentialsStatusResponse.parse(json).exists;
	}

	private async call(opts: CallOptions): Promise<unknown> {
		let lastError: unknown;
		for (let attempt = 0; attempt <= this.retries; attempt++) {
			if (attempt > 0) await sleep(100 * 2 ** (attempt - 1));
			try {
				return await this.once(opts);
			} catch (err) {
				lastError = err;
				if (!isRetryable(err)) throw err;
			}
		}
		throw lastError;
	}

	private async once(opts: CallOptions): Promise<unknown> {
		const headers: Record<string, string> = { 'x-service-token': this.options.serviceToken };
		if (opts.body !== undefined) headers['content-type'] = 'application/json';
		if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
		if (opts.correlationId) headers[CORRELATION_ID_HEADER] = opts.correlationId;

		let res: Response;
		try {
			res = await fetch(`${this.options.baseUrl}${opts.path}`, {
				method: opts.method,
				headers,
				body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
				signal: AbortSignal.timeout(this.timeoutMs),
			});
		} catch {
			throw new RetryableError('psp-adapter is unreachable or timed out');
		}

		if (res.status === 204) return undefined;
		const json: unknown = await res.json().catch(() => undefined);
		if (res.ok) return json;

		const err = ErrorResponse.safeParse(json);
		if (res.status >= 500 && !err.success) {
			throw new RetryableError(`psp-adapter returned ${res.status}`);
		}
		if (err.success) {
			const { code, message, details } = err.data.error;
			// Adapter-side failures are surfaced as 502 so callers can tell them from their own errors.
			const status = res.status >= 500 ? 502 : res.status;
			throw new AppError(code, status, message, details);
		}
		throw new AppError('PROVIDER_ERROR', 502, `psp-adapter returned ${res.status}`);
	}
}

/** Thrown for failures worth retrying; converted to a 502 once attempts run out. */
class RetryableError extends AppError {
	constructor(message: string) {
		super('PROVIDER_ERROR', 502, message);
	}
}

const isRetryable = (err: unknown) => err instanceof RetryableError;
const credentialsPath = (projectId: string, providerCode: string) =>
	`/internal/projects/${encodeURIComponent(projectId)}`
	+ `/providers/${encodeURIComponent(providerCode)}/credentials`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
