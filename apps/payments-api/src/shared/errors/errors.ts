import type { ErrorCode } from '@payments/contracts';

export class AppError extends Error {
	constructor(
		readonly code: ErrorCode,
		readonly status: number,
		message: string,
		readonly details?: unknown,
	) {
		super(message);
		this.name = 'AppError';
	}

	static notFound(message: string) {
		return new AppError('NOT_FOUND', 404, message);
	}

	static unauthorized(message = 'Unauthorized') {
		return new AppError('UNAUTHORIZED', 401, message);
	}

	static validation(details: unknown) {
		return new AppError('VALIDATION_ERROR', 400, 'Invalid request', details);
	}
}
