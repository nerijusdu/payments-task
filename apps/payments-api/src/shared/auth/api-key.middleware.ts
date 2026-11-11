import type { RequestHandler } from 'express';
import { AppError } from '@payments/http';
import type { ProjectsService } from '../../projects/projects.service.js';

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface Request {
			projectId?: string;
		}
	}
}

/** Resolves the calling project from the `x-api-key` header and sets `req.projectId`. */
export function apiKeyAuth(projects: ProjectsService): RequestHandler {
	return (req, _res, next) => {
		const apiKey = req.header('x-api-key');
		if (!apiKey) return next(AppError.unauthorized());
		projects.find({ apiKey }).then((project) => {
			if (!project) return next(AppError.unauthorized());
			req.projectId = project.id;
			next();
		}, next);
	};
}
