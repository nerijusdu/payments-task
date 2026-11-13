import { Router } from 'express';
import { CheckoutProvidersQuery } from '@payments/contracts';
import { asyncHandler, parseBody } from '@payments/http';
import type { CheckoutService } from './checkout.service.js';

/** API-key routes, mounted under /v1/checkout. */
export function checkoutExternalController(service: CheckoutService): Router {
	const router = Router();

	router.get('/providers', asyncHandler(async (req, res) => {
		const query = parseBody(CheckoutProvidersQuery, req.query);
		res.json(await service.listProviders(req.projectId!, query));
	}));

	return router;
}
