import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../errors/errors.js';

/** Shared service token for calls from payments-api (MVP). */
export function serviceAuth(serviceToken: string): RequestHandler {
	const expected = Buffer.from(serviceToken);
	return (req, _res, next) => {
		const provided = Buffer.from(req.header('x-service-token') ?? '');
		if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
			return next(AppError.unauthorized());
		}
		next();
	};
}
