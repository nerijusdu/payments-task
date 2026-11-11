import { Router } from 'express';
import { SaveCredentialsRequest } from '@payments/contracts';
import { asyncHandler } from '../shared/errors/async-handler.js';
import { parseBody } from '../shared/errors/parse.js';
import type { CredentialsService } from './credentials.service.js';

/** Service-token routes, mounted under /internal/projects/:projectId/providers/:providerCode. */
export function credentialsInternalController(service: CredentialsService): Router {
	const router = Router({ mergeParams: true });
	const keyOf = (params: Record<string, string>) => ({
		projectId: params.projectId!,
		providerCode: params.providerCode!,
	});

	router.put('/credentials', asyncHandler(async (req, res) => {
		const body = parseBody(SaveCredentialsRequest, req.body);
		await service.save(keyOf(req.params), body);
		res.status(204).end();
	}));

	router.delete('/credentials', asyncHandler(async (req, res) => {
		await service.delete(keyOf(req.params));
		res.status(204).end();
	}));

	router.get('/credentials/status', asyncHandler(async (req, res) => {
		res.json({ exists: await service.exists(keyOf(req.params)) });
	}));

	return router;
}
