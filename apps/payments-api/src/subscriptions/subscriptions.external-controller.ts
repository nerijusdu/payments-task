import { Router } from 'express';
import { CancelSubscriptionDto, CreateSubscriptionDto } from '@payments/contracts';
import { AppError, asyncHandler, parseBody } from '@payments/http';
import type { SubscriptionsService } from './subscriptions.service.js';

/** API-key routes for project backends, mounted under /v1/subscriptions. */
export function subscriptionsExternalController(service: SubscriptionsService): Router {
	const router = Router();

	router.post('/', asyncHandler(async (req, res) => {
		const idempotencyKey = req.header('idempotency-key');
		if (!idempotencyKey || idempotencyKey.length > 255) {
			throw AppError.validation({ headers: ['Idempotency-Key header is required (max 255 chars)'] });
		}
		const dto = parseBody(CreateSubscriptionDto, req.body);
		res.status(201).json(
			await service.create(req.projectId!, idempotencyKey, dto, req.correlationId),
		);
	}));

	router.get('/:id', asyncHandler(async (req, res) => {
		res.json(await service.get(req.projectId!, req.params.id!));
	}));

	router.post('/:id/cancel', asyncHandler(async (req, res) => {
		const dto = parseBody(CancelSubscriptionDto, req.body ?? {});
		res.json(await service.cancel(req.projectId!, req.params.id!, dto, req.correlationId));
	}));

	return router;
}
