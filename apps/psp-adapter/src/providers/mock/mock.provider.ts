import { randomUUID } from 'node:crypto';
import type {
	AdapterCancelSubscriptionRequest,
	AdapterCreatePaymentRequest,
	AdapterCreateSubscriptionRequest,
	AdapterPaymentResponse,
	AdapterRefundRequest,
	AdapterRefundResponse,
	AdapterSubscriptionResponse,
} from '@payments/contracts';
import type { PaymentProvider, ProviderContext } from '../payment-provider.js';

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
}

function mockCheckoutUrl(returnUrl: string, objectId: string): string {
	const url = new URL(returnUrl);
	url.searchParams.set('mock_object', objectId);
	return url.toString();
}
