import { Router } from 'express';
import { CreatePlanDto } from '@payments/contracts';
import { asyncHandler, parseBody } from '@payments/http';
import type { PlansService } from './plans.service.js';

/** Admin-token routes, mounted under /v1/admin/projects/:projectId/plans. */
export function plansAdminController(service: PlansService): Router {
	const router = Router({ mergeParams: true });

	router.post('/', asyncHandler(async (req, res) => {
		const dto = parseBody(CreatePlanDto, req.body);
		res.status(201).json(await service.create(req.params.projectId!, dto));
	}));

	return router;
}
