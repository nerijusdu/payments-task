import { Router } from 'express';
import { AdminListSubscriptionsQuery } from '@payments/contracts';
import { asyncHandler, parseBody } from '@payments/http';
import type { SubscriptionsService } from './subscriptions.service.js';

/** Admin-token routes, mounted under /v1/admin/subscriptions. */
export function subscriptionsAdminController(service: SubscriptionsService): Router {
	const router = Router();

	router.get('/', asyncHandler(async (req, res) => {
		const query = parseBody(AdminListSubscriptionsQuery, req.query);
		res.json(await service.listForAdmin(query));
	}));

	return router;
}
