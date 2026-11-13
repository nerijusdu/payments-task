import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { PaymentStatus, RefundStatus, SubscriptionStatus } from '@payments/contracts';
import { AppError } from '@payments/http';
import type {
	NormalizedWebhookEvent,
	AdapterCancelSubscriptionRequest,
	AdapterCreatePaymentRequest,
	AdapterCreateSubscriptionRequest,
	AdapterPaymentResponse,
	AdapterRefundRequest,
	AdapterRefundResponse,
	AdapterSubscriptionResponse,
} from '@payments/contracts';
import type { PaymentProvider, ProviderContext, RawWebhook } from '../payment-provider.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Generic mock PSP: no network calls, every payment asks the customer to follow a redirect. */
export class MockProvider implements PaymentProvider {
	readonly code = 'mock';

	async createPayment(
		_ctx: ProviderContext,
		req: AdapterCreatePaymentRequest,
	): Promise<AdapterPaymentResponse> {
		const providerPaymentId = `mock_pay_${randomUUID()}`;
		return {
			providerPaymentId,
			providerCustomerId: req.customer.providerCustomerId ?? `mock_cus_${randomUUID()}`,
			status: 'requires_action',
			action: { type: 'redirect', url: mockCheckoutUrl(req.returnUrl, providerPaymentId) },
		};
	}

	async createSubscription(
		_ctx: ProviderContext,
		req: AdapterCreateSubscriptionRequest,
	): Promise<AdapterSubscriptionResponse> {
		const providerSubscriptionId = `mock_sub_${randomUUID()}`;
		const start = new Date();
		return {
			providerSubscriptionId,
			providerCustomerId: req.customer.providerCustomerId ?? `mock_cus_${randomUUID()}`,
			status: 'pending',
			currentPeriodStart: start.toISOString(),
			currentPeriodEnd: new Date(start.getTime() + 30 * DAY_MS).toISOString(),
			action: { type: 'redirect', url: mockCheckoutUrl(req.returnUrl, providerSubscriptionId) },
		};
	}

	async cancelSubscription(
		_ctx: ProviderContext,
		providerSubscriptionId: string,
		req: AdapterCancelSubscriptionRequest,
	): Promise<AdapterSubscriptionResponse> {
		return {
			providerSubscriptionId,
			status: req.atPeriodEnd ? 'active' : 'canceled',
		};
	}

	async refund(
		_ctx: ProviderContext,
		_providerPaymentId: string,
		_req: AdapterRefundRequest,
	): Promise<AdapterRefundResponse> {
		return { providerRefundId: `mock_ref_${randomUUID()}`, status: 'succeeded' };
	}

	/** Signature: hex HMAC-SHA256 of the raw body with the webhook secret, in `x-mock-signature`. */
	parseWebhook(webhook: RawWebhook): NormalizedWebhookEvent | null {
		const header = webhook.headers['x-mock-signature'];
		const provided = Buffer.from(typeof header === 'string' ? header : '', 'hex');
		const expected = webhook.webhookSecret
			? createHmac('sha256', webhook.webhookSecret).update(webhook.rawBody).digest()
			: null;

		if (
			!expected
			|| provided.length !== expected.length
			|| !timingSafeEqual(provided, expected)
		) {
			throw AppError.unauthorized('Invalid webhook signature');
		}

		let json: unknown;
		try {
			json = JSON.parse(webhook.rawBody.toString('utf8'));
		} catch {
			throw AppError.validation({ body: ['Invalid JSON'] });
		}

		const body = MockWebhookBody.safeParse(json);
		if (!body.success) {
			throw AppError.validation(body.error.flatten());
		}
		const b = body.data;

		const status = b.type.startsWith('subscription')
			? SubscriptionStatus.safeParse(b.status)
			: b.type === 'refund.updated'
				? RefundStatus.safeParse(b.status)
				: PaymentStatus.safeParse(b.status);
		if (!status.success) {
			return null;
		}

		return {
			type: b.type,
			providerCode: this.code,
			projectId: webhook.projectId,
			providerEventId: b.id,
			providerObjectId: b.objectId,
			providerSubscriptionId: b.subscriptionId,
			status: status.data as NormalizedWebhookEvent['status'],
			amount: b.amount,
			currency: b.currency,
			currentPeriodStart: b.currentPeriodStart,
			currentPeriodEnd: b.currentPeriodEnd,
			occurredAt: b.occurredAt ?? new Date().toISOString(),
		};
	}
}

const MockWebhookBody = z.object({
	id: z.string().min(1),
	type: z.enum(['payment.updated', 'refund.updated', 'subscription.updated', 'subscription.renewed']),
	objectId: z.string().min(1),
	status: z.string(),
	subscriptionId: z.string().optional(),
	amount: z.number().int().nonnegative().optional(),
	currency: z.string().length(3).optional(),
	currentPeriodStart: z.string().datetime().optional(),
	currentPeriodEnd: z.string().datetime().optional(),
	occurredAt: z.string().datetime().optional(),
});

function mockCheckoutUrl(returnUrl: string, objectId: string): string {
	const url = new URL(returnUrl);
	url.searchParams.set('mock_object', objectId);
	return url.toString();
}
