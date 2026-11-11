import type {
	AdapterCancelSubscriptionRequest,
	AdapterCreatePaymentRequest,
	AdapterCreateSubscriptionRequest,
	AdapterPaymentResponse,
	AdapterRefundRequest,
	AdapterRefundResponse,
	AdapterSubscriptionResponse,
} from '@payments/contracts';

export interface CredentialEnvelope {
	credentials: Record<string, unknown>;
	webhookSecret?: string;
}

/** Per-call context: the project's decrypted credentials and the forwarded idempotency key. */
export interface ProviderContext {
	credentials: Record<string, unknown>;
	idempotencyKey?: string;
}

/** One implementation per PSP. Maps PSP states to normalized statuses. */
export interface PaymentProvider {
	readonly code: string;
	createPayment(
		ctx: ProviderContext,
		req: AdapterCreatePaymentRequest,
	): Promise<AdapterPaymentResponse>;
	createSubscription(
		ctx: ProviderContext,
		req: AdapterCreateSubscriptionRequest,
	): Promise<AdapterSubscriptionResponse>;
	cancelSubscription(
		ctx: ProviderContext,
		providerSubscriptionId: string,
		req: AdapterCancelSubscriptionRequest,
	): Promise<AdapterSubscriptionResponse>;
	refund(
		ctx: ProviderContext,
		providerPaymentId: string,
		req: AdapterRefundRequest,
	): Promise<AdapterRefundResponse>;
}
