import { z } from 'zod';
import { CurrencyCode, PaymentStatus, SubscriptionStatus } from './common.js';

export const CreateProjectDto = z.object({
	name: z.string().min(1),
	webhookUrl: z.string().url().optional(),
});
export type CreateProjectDto = z.infer<typeof CreateProjectDto>;

export const UpdateProjectDto = z.object({
	name: z.string().min(1).optional(),
	/** Null clears the URL. */
	webhookUrl: z.string().url().nullable().optional(),
});
export type UpdateProjectDto = z.infer<typeof UpdateProjectDto>;

/** The API key and webhook secret are returned once, at creation. */
export const CreateProjectResponseDto = z.object({
	id: z.string(),
	name: z.string(),
	apiKey: z.string(),
	webhookSecret: z.string().optional(),
});
export type CreateProjectResponseDto = z.infer<typeof CreateProjectResponseDto>;

export const ConfigureProviderDto = z.object({
	isEnabled: z.boolean(),
	sortOrder: z.number().int().default(0),
	supportedMethods: z.array(z.string()).default([]),
	currencies: z.array(CurrencyCode).default([]),
	/** Forwarded to psp-adapter, never stored or logged by payments-api. */
	credentials: z.record(z.unknown()),
	webhookSecret: z.string().optional(),
});
export type ConfigureProviderDto = z.infer<typeof ConfigureProviderDto>;

export const CreatePlanDto = z.object({
	code: z.string().min(1),
	name: z.string().min(1),
	amount: z.number().int().positive(),
	currency: CurrencyCode,
	interval: z.enum(['day', 'week', 'month', 'year']),
	intervalCount: z.number().int().positive().default(1),
	trialDays: z.number().int().min(0).default(0),
	providerMappings: z
		.array(z.object({ providerCode: z.string(), providerPriceId: z.string() }))
		.default([]),
});
export type CreatePlanDto = z.infer<typeof CreatePlanDto>;

export const AdminLoginDto = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
});
export type AdminLoginDto = z.infer<typeof AdminLoginDto>;

export const AdminListPaymentsQuery = z.object({
	projectId: z.string().uuid().optional(),
	status: PaymentStatus.optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	offset: z.coerce.number().int().min(0).default(0),
});
export type AdminListPaymentsQuery = z.infer<typeof AdminListPaymentsQuery>;

export const AdminListSubscriptionsQuery = z.object({
	projectId: z.string().uuid().optional(),
	status: SubscriptionStatus.optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	offset: z.coerce.number().int().min(0).default(0),
});
export type AdminListSubscriptionsQuery = z.infer<typeof AdminListSubscriptionsQuery>;
