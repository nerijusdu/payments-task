const baseUrl = process.env.PAYMENTS_API_URL ?? 'http://localhost:3000';

export type Payment = {
	id: string;
	status: 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
	amount: number;
	currency: string;
	providerCode: string;
	action?: { type: 'redirect' | 'client_secret'; url?: string; clientSecret?: string };
};

export class PaymentsApiError extends Error {
	constructor(public status: number, message: string) {
		super(message);
	}
}

type CallInit = RequestInit & { idempotencyKey?: string };

async function call<T>(path: string, init: CallInit = {}): Promise<T> {
	const apiKey = process.env.PAYMENTS_API_KEY;
	if (!apiKey) {
		throw new PaymentsApiError(500, 'PAYMENTS_API_KEY is not set');
	}
	const { idempotencyKey, ...rest } = init;
	const res = await fetch(`${baseUrl}${path}`, {
		...rest,
		cache: 'no-store',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
		},
	});
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const message = body?.error?.message ?? `Payments API error ${res.status}`;
		throw new PaymentsApiError(res.status, message);
	}
	return body as T;
}

export function createPayment(input: {
	idempotencyKey: string;
	amount: number;
	currency: string;
	customerRef: string;
	email?: string;
	returnUrl: string;
	metadata?: Record<string, string>;
}) {
	return call<Payment>('/v1/payments', {
		method: 'POST',
		idempotencyKey: input.idempotencyKey,
		body: JSON.stringify({
			providerCode: 'mock',
			amount: input.amount,
			currency: input.currency,
			customer: { externalRef: input.customerRef, email: input.email },
			returnUrl: input.returnUrl,
			metadata: input.metadata,
		}),
	});
}

export function getPayment(id: string) {
	return call<Payment>(`/v1/payments/${encodeURIComponent(id)}`);
}
