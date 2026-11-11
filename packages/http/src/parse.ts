import type { z } from 'zod';
import { AppError } from './errors.js';

export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
	const result = schema.safeParse(body);
	if (!result.success) throw AppError.validation(result.error.flatten());
	return result.data;
}
