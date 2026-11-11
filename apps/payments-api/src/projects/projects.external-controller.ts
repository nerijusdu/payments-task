import { Router } from 'express';
import { CreateProjectDto } from '@payments/contracts';
import { asyncHandler } from '../shared/errors/async-handler.js';
import { parseBody } from '../shared/errors/parse.js';
import type { ProjectsService } from './projects.service.js';

/** Admin-token routes. Provider configuration is added with the payments flow. */
export function projectsExternalController(service: ProjectsService): Router {
	const router = Router();

	router.post('/', asyncHandler(async (req, res) => {
		const dto = parseBody(CreateProjectDto, req.body);
		res.status(201).json(await service.create(dto));
	}));

	return router;
}
