import { z } from 'zod';
import { CurrencyCode, PaymentStatus, ProviderCode, SubscriptionStatus } from './common.js';

export const WebhookEventType = z.enum([
  'payment.updated',
  'refund.updated',
  'subscription.updated',
  'subscription.renewed',
]);
export type WebhookEventType = z.infer<typeof WebhookEventType>;

/** What the adapter derives from a raw PSP webhook after verifying its signature. */
export const NormalizedWebhookEvent = z.object({
  type: WebhookEventType,
  providerCode: ProviderCode,
  projectId: z.string(),
  providerEventId: z.string(),
  /** PSP-side id of the payment, refund or subscription the event is about. */
  providerObjectId: z.string(),
  /** Set for renewals so payments-api can link a new payment to its subscription. */
  providerSubscriptionId: z.string().optional(),
  status: z.union([PaymentStatus, SubscriptionStatus]),
  amount: z.number().int().nonnegative().optional(),
  currency: CurrencyCode.optional(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  occurredAt: z.string().datetime(),
  /** Reference to the raw payload; the payload itself is not forwarded. */
  rawReference: z.string().optional(),
});
export type NormalizedWebhookEvent = z.infer<typeof NormalizedWebhookEvent>;

/** Queue payload for "webhook-events". */
export const WebhookEventsMessage = z.object({ event: NormalizedWebhookEvent });
export type WebhookEventsMessage = z.infer<typeof WebhookEventsMessage>;

export const OutboundEventType = z.enum([
  'payment.succeeded',
  'payment.failed',
  'payment.canceled',
  'payment.refunded',
  'refund.succeeded',
  'subscription.updated',
]);
export type OutboundEventType = z.infer<typeof OutboundEventType>;

/** Queue payload for "outbound-webhooks"; the row in `outbound_webhooks` holds the body. */
export const OutboundWebhooksMessage = z.object({ outboundWebhookId: z.string() });
export type OutboundWebhooksMessage = z.infer<typeof OutboundWebhooksMessage>;
