import { z } from 'zod';

/** Integer minor units (cents). */
export const MoneyAmount = z.number().int().positive();

/** ISO 4217 code, uppercase. */
export const CurrencyCode = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Must be an uppercase ISO 4217 code');

export const ProviderCode = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/);

export const PaymentStatus = z.enum([
  'pending',
  'requires_action',
  'succeeded',
  'failed',
  'canceled',
  'refunded',
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const SubscriptionStatus = z.enum(['pending', 'trialing', 'active', 'past_due', 'canceled']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const RefundStatus = z.enum(['pending', 'succeeded', 'failed']);
export type RefundStatus = z.infer<typeof RefundStatus>;

export const CustomerRef = z.object({
  externalRef: z.string().min(1),
  email: z.string().email().optional(),
});
export type CustomerRef = z.infer<typeof CustomerRef>;

export const Metadata = z.record(z.string());

export const PaymentAction = z.object({
  type: z.enum(['redirect', 'client_secret']),
  url: z.string().url().optional(),
  clientSecret: z.string().optional(),
});
export type PaymentAction = z.infer<typeof PaymentAction>;

export const ErrorCode = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'IDEMPOTENCY_CONFLICT',
  'INVALID_STATE_TRANSITION',
  'PROVIDER_NOT_ENABLED',
  'CREDENTIALS_NOT_FOUND',
  'PROVIDER_ERROR',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorResponse = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
    correlationId: z.string().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const CORRELATION_ID_HEADER = 'x-correlation-id';
