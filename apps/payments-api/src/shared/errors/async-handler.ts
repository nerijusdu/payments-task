import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const asyncHandler = (
	fn: (req: Request, res: Response) => Promise<void>,
): RequestHandler =>
	(req, res, next: NextFunction) => {
		fn(req, res).catch(next);
	};
