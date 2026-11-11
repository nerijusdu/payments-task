import { Router } from 'express';
import { CreatePaymentDto } from '@payments/contracts';
import { AppError, asyncHandler, parseBody } from '@payments/http';
import type { PaymentsService } from './payments.service.js';

/** API-key routes for project backends, mounted under /v1/payments. */
export function paymentsExternalController(service: PaymentsService): Router {
	const router = Router();

	router.post('/', asyncHandler(async (req, res) => {
		const idempotencyKey = req.header('idempotency-key');
		if (!idempotencyKey || idempotencyKey.length > 255) {
			throw AppError.validation({ headers: ['Idempotency-Key header is required (max 255 chars)'] });
		}
		const dto = parseBody(CreatePaymentDto, req.body);
		res.status(201).json(
			await service.create(req.projectId!, idempotencyKey, dto, req.correlationId),
		);
	}));

	router.get('/:id', asyncHandler(async (req, res) => {
		res.json(await service.get(req.projectId!, req.params.id!));
	}));

	return router;
}
