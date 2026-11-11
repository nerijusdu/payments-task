import { z } from 'zod';
import { CurrencyCode } from './common.js';

export const CreateProjectDto = z.object({
  name: z.string().min(1),
  webhookUrl: z.string().url().optional(),
});
export type CreateProjectDto = z.infer<typeof CreateProjectDto>;

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
