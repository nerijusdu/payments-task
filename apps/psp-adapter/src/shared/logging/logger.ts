import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { pino } from 'pino';
import { CORRELATION_ID_HEADER } from '@payments/contracts';

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface Request {
			correlationId?: string;
		}
	}
}

export function createLogger(level: string) {
	return pino({ level, redact: ['req.headers.authorization', 'req.headers["x-service-token"]'] });
}

export function correlationMiddleware(logger: ReturnType<typeof createLogger>): RequestHandler {
	return (req, res, next) => {
		const incoming = req.header(CORRELATION_ID_HEADER);
		const correlationId = incoming ?? randomUUID();
		req.correlationId = correlationId;
		res.setHeader(CORRELATION_ID_HEADER, correlationId);
		// Method and path only: bodies are never logged (config endpoints carry secrets).
		logger.info({ correlationId, method: req.method, path: req.path }, 'request');
		next();
	};
}
