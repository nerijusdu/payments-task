import { Router } from 'express';
import { AdminListPaymentsQuery } from '@payments/contracts';
import { asyncHandler, parseBody } from '@payments/http';
import type { PaymentsService } from './payments.service.js';

/** Admin-token routes, mounted under /v1/admin/payments. */
export function paymentsAdminController(service: PaymentsService): Router {
	const router = Router();

	router.get('/', asyncHandler(async (req, res) => {
		const query = parseBody(AdminListPaymentsQuery, req.query);
		res.json(await service.listForAdmin(query));
	}));

	return router;
}
