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

	static credentialsNotFound(projectId: string, providerCode: string) {
		return new AppError(
			'CREDENTIALS_NOT_FOUND',
			422,
			`No credentials for project ${projectId} and provider ${providerCode}`,
		);
	}

	static provider(message: string, details?: unknown) {
		return new AppError('PROVIDER_ERROR', 502, message, details);
	}
}
