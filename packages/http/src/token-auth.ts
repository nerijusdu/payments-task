import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from './errors.js';

/** Static shared-token check on a request header (admin token, service token). */
export function tokenAuth(headerName: string, token: string): RequestHandler {
	const expected = Buffer.from(token);
	return (req, _res, next) => {
		const provided = Buffer.from(req.header(headerName) ?? '');
		if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
			return next(AppError.unauthorized());
		}
		next();
	};
}
