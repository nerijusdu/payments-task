import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { AppError } from './errors.js';

export function errorHandler(logger: Logger): ErrorRequestHandler {
	return (err, req, res, _next) => {
		const correlationId = req.correlationId;
		if (err instanceof AppError) {
			res.status(err.status).json({
				error: {
					code: err.code,
					message: err.message,
					details: err.details,
					correlationId,
				},
			});
			return;
		}
		logger.error({ correlationId, err: { message: (err as Error).message } }, 'unhandled error');
		res.status(500).json({
			error: { code: 'INTERNAL_ERROR', message: 'Internal error', correlationId },
		});
	};
}
