import { Router } from 'express';
import { AdapterCancelSubscriptionRequest, AdapterCreateSubscriptionRequest } from '@payments/contracts';
import { asyncHandler, parseBody } from '@payments/http';
import type { SubscriptionsService } from './subscriptions.service.js';

/** Service-token routes, mounted under /v1/:providerCode/subscriptions. */
export function subscriptionsInternalController(service: SubscriptionsService): Router {
	const router = Router({ mergeParams: true });

	router.post('/', asyncHandler(async (req, res) => {
		const body = parseBody(AdapterCreateSubscriptionRequest, req.body);
		res.status(201).json(
			await service.create(req.params.providerCode!, body, req.header('idempotency-key')),
		);
	}));

	router.post('/:id/cancel', asyncHandler(async (req, res) => {
		const body = parseBody(AdapterCancelSubscriptionRequest, req.body);
		res.json(
			await service.cancel(
				req.params.providerCode!,
				req.params.id!,
				body,
				req.header('idempotency-key'),
			),
		);
	}));

	return router;
}
