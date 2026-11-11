import { Router } from 'express';
import { AdapterRefundRequest } from '@payments/contracts';
import { asyncHandler } from '../shared/errors/async-handler.js';
import { parseBody } from '../shared/errors/parse.js';
import type { RefundsService } from './refunds.service.js';

/** Service-token routes, mounted under /v1/:providerCode/payments. */
export function refundsInternalController(service: RefundsService): Router {
	const router = Router({ mergeParams: true });

	router.post('/:providerPaymentId/refunds', asyncHandler(async (req, res) => {
		const body = parseBody(AdapterRefundRequest, req.body);
		res.status(201).json(
			await service.create(
				req.params.providerCode!,
				req.params.providerPaymentId!,
				body,
				req.header('idempotency-key'),
			),
		);
	}));

	return router;
}
