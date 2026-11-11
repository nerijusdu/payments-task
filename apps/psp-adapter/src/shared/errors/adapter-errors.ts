import { AppError } from '@payments/http';

export const credentialsNotFound = (projectId: string, providerCode: string) =>
	new AppError(
		'CREDENTIALS_NOT_FOUND',
		422,
		`No credentials for project ${projectId} and provider ${providerCode}`,
	);

export const providerError = (message: string, details?: unknown) =>
	new AppError('PROVIDER_ERROR', 502, message, details);
