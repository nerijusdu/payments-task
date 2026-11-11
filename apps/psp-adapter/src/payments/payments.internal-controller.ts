import { Router } from 'express';
import { AdapterCreatePaymentRequest } from '@payments/contracts';
import { asyncHandler } from '../shared/errors/async-handler.js';
import { parseBody } from '../shared/errors/parse.js';
import type { PaymentsService } from './payments.service.js';

/** Service-token routes, mounted under /v1/:providerCode/payments. */
export function paymentsInternalController(service: PaymentsService): Router {
	const router = Router({ mergeParams: true });

	router.post('/', asyncHandler(async (req, res) => {
		const body = parseBody(AdapterCreatePaymentRequest, req.body);
		res.status(201).json(
			await service.create(req.params.providerCode!, body, req.header('idempotency-key')),
		);
	}));

	return router;
}
