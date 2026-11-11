import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../errors/errors.js';

export function adminAuth(adminToken: string): RequestHandler {
	const expected = Buffer.from(adminToken);
	return (req, _res, next) => {
		const provided = Buffer.from(req.header('x-admin-token') ?? '');
		if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
			return next(AppError.unauthorized());
		}
		next();
	};
}
