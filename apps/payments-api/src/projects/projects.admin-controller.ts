import { Router } from 'express';
import { ConfigureProviderDto, CreateProjectDto, UpdateProjectDto } from '@payments/contracts';
import { asyncHandler, parseBody } from '@payments/http';
import type { ProjectsService } from './projects.service.js';

/** Admin-token routes. Bodies of the provider routes carry secrets and are never logged. */
export function projectsAdminController(service: ProjectsService): Router {
	const router = Router();

	router.get('/', asyncHandler(async (_req, res) => {
		res.json(await service.list());
	}));

	router.get('/:projectId', asyncHandler(async (req, res) => {
		res.json(await service.getDetail(req.params.projectId!));
	}));

	router.patch('/:projectId', asyncHandler(async (req, res) => {
		const dto = parseBody(UpdateProjectDto, req.body);
		res.json(await service.update(req.params.projectId!, dto));
	}));

	router.post('/', asyncHandler(async (req, res) => {
		const dto = parseBody(CreateProjectDto, req.body);
		res.status(201).json(await service.create(dto));
	}));

	router.put('/:projectId/providers/:providerCode', asyncHandler(async (req, res) => {
		const dto = parseBody(ConfigureProviderDto, req.body);
		const saved = await service.configureProvider(
			req.params.projectId!,
			req.params.providerCode!,
			dto,
		);
		res.json({
			providerCode: req.params.providerCode,
			isEnabled: saved.isEnabled,
			sortOrder: saved.sortOrder,
			supportedMethods: saved.supportedMethods,
			currencies: saved.currencies,
		});
	}));

	router.delete('/:projectId/providers/:providerCode', asyncHandler(async (req, res) => {
		await service.removeProvider(req.params.projectId!, req.params.providerCode!);
		res.status(204).end();
	}));

	return router;
}
