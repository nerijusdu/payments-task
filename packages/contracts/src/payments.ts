import { z } from 'zod';
import {
	CurrencyCode,
	CustomerRef,
	Metadata,
	MoneyAmount,
	PaymentAction,
	PaymentStatus,
	ProviderCode,
	RefundStatus,
	SubscriptionStatus,
} from './common.js';

export const CreatePaymentDto = z.object({
	providerCode: ProviderCode,
	amount: MoneyAmount,
	currency: CurrencyCode,
	customer: CustomerRef,
	returnUrl: z.string().url(),
	metadata: Metadata.optional(),
});
export type CreatePaymentDto = z.infer<typeof CreatePaymentDto>;

export const PaymentResponseDto = z.object({
	id: z.string(),
	status: PaymentStatus,
	amount: MoneyAmount,
	currency: CurrencyCode,
	providerCode: ProviderCode,
	action: PaymentAction.optional(),
});
export type PaymentResponseDto = z.infer<typeof PaymentResponseDto>;

export const CreateRefundDto = z.object({
	/** Omit for a full refund. */
	amount: MoneyAmount.optional(),
	reason: z.string().max(500).optional(),
});
export type CreateRefundDto = z.infer<typeof CreateRefundDto>;

export const RefundResponseDto = z.object({
	id: z.string(),
	paymentId: z.string(),
	amount: MoneyAmount,
	status: RefundStatus,
	reason: z.string().optional(),
});
export type RefundResponseDto = z.infer<typeof RefundResponseDto>;

export const CreateSubscriptionDto = z.object({
	providerCode: ProviderCode,
	planCode: z.string().min(1),
	customer: CustomerRef,
	returnUrl: z.string().url(),
	trialDays: z.number().int().min(0).optional(),
});
export type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionDto>;

export const SubscriptionResponseDto = z.object({
	id: z.string(),
	status: SubscriptionStatus,
	planCode: z.string(),
	providerCode: ProviderCode,
	amount: MoneyAmount,
	currency: CurrencyCode,
	currentPeriodStart: z.string().datetime().optional(),
	currentPeriodEnd: z.string().datetime().optional(),
	cancelAtPeriodEnd: z.boolean(),
	canceledAt: z.string().datetime().optional(),
	action: PaymentAction.optional(),
});
export type SubscriptionResponseDto = z.infer<typeof SubscriptionResponseDto>;

export const CancelSubscriptionDto = z.object({
	atPeriodEnd: z.boolean().default(true),
});
export type CancelSubscriptionDto = z.infer<typeof CancelSubscriptionDto>;

export const CheckoutProvidersQuery = z.object({
	currency: CurrencyCode.optional(),
	amount: z.coerce.number().int().positive().optional(),
});
export type CheckoutProvidersQuery = z.infer<typeof CheckoutProvidersQuery>;

export const CheckoutProvidersResponseDto = z.object({
	providers: z.array(
		z.object({
			code: ProviderCode,
			name: z.string(),
			methods: z.array(z.string()),
		}),
	),
});
export type CheckoutProvidersResponseDto = z.infer<typeof CheckoutProvidersResponseDto>;
