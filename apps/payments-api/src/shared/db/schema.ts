import {
	boolean, index, integer, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

export const payments = pgSchema('payments');

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const projects = payments.table('projects', {
	id: id(),
	name: text('name').notNull(),
	apiKeyHash: text('api_key_hash').notNull().unique(),
	webhookUrl: text('webhook_url'),
	webhookSecret: text('webhook_secret').notNull(),
	createdAt: createdAt(),
});

export const providers = payments.table('providers', {
	id: id(),
	code: text('code').notNull().unique(),
	name: text('name').notNull(),
	isActive: boolean('is_active').notNull().default(true),
});

export const projectProviders = payments.table('project_providers', {
	id: id(),
	projectId: uuid('project_id').notNull().references(() => projects.id),
	providerId: uuid('provider_id').notNull().references(() => providers.id),
	isEnabled: boolean('is_enabled').notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0),
	supportedMethods: text('supported_methods').array().notNull().default([]),
	currencies: text('currencies').array().notNull().default([]),
}, (t) => [uniqueIndex('project_providers_project_provider_uq').on(t.projectId, t.providerId)]);

export const customers = payments.table('customers', {
	id: id(),
	projectId: uuid('project_id').notNull().references(() => projects.id),
	externalRef: text('external_ref').notNull(),
	email: text('email'),
	createdAt: createdAt(),
}, (t) => [uniqueIndex('customers_project_external_ref_uq').on(t.projectId, t.externalRef)]);

export const providerCustomers = payments.table('provider_customers', {
	id: id(),
	customerId: uuid('customer_id').notNull().references(() => customers.id),
	providerId: uuid('provider_id').notNull().references(() => providers.id),
	providerCustomerId: text('provider_customer_id').notNull(),
}, (t) => [index('provider_customers_lookup_idx').on(t.providerId, t.providerCustomerId)]);

export const plans = payments.table('plans', {
	id: id(),
	projectId: uuid('project_id').notNull().references(() => projects.id),
	code: text('code').notNull(),
	name: text('name').notNull(),
	amount: integer('amount').notNull(),
	currency: text('currency').notNull(),
	interval: text('interval', { enum: ['day', 'week', 'month', 'year'] }).notNull(),
	intervalCount: integer('interval_count').notNull().default(1),
	trialDays: integer('trial_days').notNull().default(0),
	createdAt: createdAt(),
}, (t) => [uniqueIndex('plans_project_code_uq').on(t.projectId, t.code)]);

export const planProviderMappings = payments.table('plan_provider_mappings', {
	planId: uuid('plan_id').notNull().references(() => plans.id),
	providerId: uuid('provider_id').notNull().references(() => providers.id),
	providerPriceId: text('provider_price_id').notNull(),
}, (t) => [uniqueIndex('plan_provider_mappings_uq').on(t.planId, t.providerId)]);

export const subscriptions = payments.table('subscriptions', {
	id: id(),
	projectId: uuid('project_id').notNull().references(() => projects.id),
	customerId: uuid('customer_id').notNull().references(() => customers.id),
	planId: uuid('plan_id').notNull().references(() => plans.id),
	providerId: uuid('provider_id').notNull().references(() => providers.id),
	providerSubscriptionId: text('provider_subscription_id'),
	status: text('status', {
		enum: ['pending', 'trialing', 'active', 'past_due', 'canceled'],
	}).notNull().default('pending'),
	amount: integer('amount').notNull(),
	currency: text('currency').notNull(),
	currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
	currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
	cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
	canceledAt: timestamp('canceled_at', { withTimezone: true }),
	createdAt: createdAt(),
}, (t) => [index('subscriptions_provider_sub_idx').on(t.providerId, t.providerSubscriptionId)]);

export const paymentsTable = payments.table('payments', {
	id: id(),
	projectId: uuid('project_id').notNull().references(() => projects.id),
	customerId: uuid('customer_id').notNull().references(() => customers.id),
	providerId: uuid('provider_id').notNull().references(() => providers.id),
	subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
	amount: integer('amount').notNull(),
	currency: text('currency').notNull(),
	status: text('status', {
		enum: ['pending', 'requires_action', 'succeeded', 'failed', 'canceled', 'refunded'],
	}).notNull().default('pending'),
	providerPaymentId: text('provider_payment_id'),
	idempotencyKey: text('idempotency_key').notNull(),
	metadata: jsonb('metadata').$type<Record<string, string>>(),
	createdAt: createdAt(),
}, (t) => [
	uniqueIndex('payments_project_idempotency_uq').on(t.projectId, t.idempotencyKey),
	index('payments_provider_payment_idx').on(t.providerId, t.providerPaymentId),
]);

export const refunds = payments.table('refunds', {
	id: id(),
	paymentId: uuid('payment_id').notNull().references(() => paymentsTable.id),
	amount: integer('amount').notNull(),
	status: text('status', { enum: ['pending', 'succeeded', 'failed'] }).notNull(),
	providerRefundId: text('provider_refund_id'),
	reason: text('reason'),
	createdAt: createdAt(),
});

export const webhookEvents = payments.table('webhook_events', {
	id: id(),
	providerId: uuid('provider_id').notNull().references(() => providers.id),
	providerEventId: text('provider_event_id').notNull(),
	payload: jsonb('payload').notNull(),
	status: text('status', { enum: ['received', 'processed', 'failed'] }).notNull(),
	receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
	processedAt: timestamp('processed_at', { withTimezone: true }),
	error: text('error'),
}, (t) => [uniqueIndex('webhook_events_provider_event_uq').on(t.providerId, t.providerEventId)]);

export const outboundWebhooks = payments.table('outbound_webhooks', {
	id: id(),
	projectId: uuid('project_id').notNull().references(() => projects.id),
	eventType: text('event_type').notNull(),
	payload: jsonb('payload').notNull(),
	status: text('status', { enum: ['pending', 'delivered', 'failed'] }).notNull(),
	attempts: integer('attempts').notNull().default(0),
	lastError: text('last_error'),
	deliveredAt: timestamp('delivered_at', { withTimezone: true }),
	createdAt: createdAt(),
});
