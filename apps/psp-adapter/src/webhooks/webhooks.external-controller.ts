import { Router } from 'express';
import { asyncHandler } from '@payments/http';
import type { WebhooksService } from './webhooks.service.js';

/** PSP-facing route; authenticated by the PSP's signature, verified in the service. */
export function webhooksExternalController(service: WebhooksService): Router {
	const router = Router();

	router.post('/:providerCode/:projectId', asyncHandler(async (req, res) => {
		await service.handle({
			providerCode: req.params.providerCode!,
			projectId: req.params.projectId!,
			rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
			headers: req.headers,
		});
		res.status(200).json({ received: true });
	}));

	return router;
}
