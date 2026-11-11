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

/** payments-api -> psp-adapter. Header `Idempotency-Key` is forwarded to the PSP. */

export const AdapterCreatePaymentRequest = z.object({
  projectId: z.string(),
  paymentId: z.string(),
  amount: MoneyAmount,
  currency: CurrencyCode,
  customer: CustomerRef.extend({ providerCustomerId: z.string().optional() }),
  returnUrl: z.string().url(),
  metadata: Metadata.optional(),
});
export type AdapterCreatePaymentRequest = z.infer<typeof AdapterCreatePaymentRequest>;

export const AdapterPaymentResponse = z.object({
  providerPaymentId: z.string(),
  providerCustomerId: z.string().optional(),
  status: PaymentStatus,
  action: PaymentAction.optional(),
});
export type AdapterPaymentResponse = z.infer<typeof AdapterPaymentResponse>;

export const AdapterCreateSubscriptionRequest = z.object({
  projectId: z.string(),
  subscriptionId: z.string(),
  providerPriceId: z.string(),
  amount: MoneyAmount,
  currency: CurrencyCode,
  customer: CustomerRef.extend({ providerCustomerId: z.string().optional() }),
  returnUrl: z.string().url(),
  trialDays: z.number().int().min(0).optional(),
});
export type AdapterCreateSubscriptionRequest = z.infer<typeof AdapterCreateSubscriptionRequest>;

export const AdapterSubscriptionResponse = z.object({
  providerSubscriptionId: z.string(),
  providerCustomerId: z.string().optional(),
  status: SubscriptionStatus,
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  action: PaymentAction.optional(),
});
export type AdapterSubscriptionResponse = z.infer<typeof AdapterSubscriptionResponse>;

export const AdapterCancelSubscriptionRequest = z.object({
  projectId: z.string(),
  atPeriodEnd: z.boolean(),
});
export type AdapterCancelSubscriptionRequest = z.infer<typeof AdapterCancelSubscriptionRequest>;

export const AdapterRefundRequest = z.object({
  projectId: z.string(),
  refundId: z.string(),
  amount: MoneyAmount,
  reason: z.string().optional(),
});
export type AdapterRefundRequest = z.infer<typeof AdapterRefundRequest>;

export const AdapterRefundResponse = z.object({
  providerRefundId: z.string(),
  status: RefundStatus,
});
export type AdapterRefundResponse = z.infer<typeof AdapterRefundResponse>;

/** Credential management (write-only secrets). */

export const SaveCredentialsRequest = z.object({
  credentials: z.record(z.unknown()),
  webhookSecret: z.string().optional(),
});
export type SaveCredentialsRequest = z.infer<typeof SaveCredentialsRequest>;

export const CredentialsStatusResponse = z.object({ exists: z.boolean() });
export type CredentialsStatusResponse = z.infer<typeof CredentialsStatusResponse>;

export const AdapterProviderParams = z.object({
  providerCode: ProviderCode,
  projectId: z.string(),
});
