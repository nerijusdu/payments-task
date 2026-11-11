import type { NextFunction, Request, RequestHandler, Response } from 'express';

// TODO: is this still needed with express 5?
export const asyncHandler = (
	fn: (req: Request, res: Response) => Promise<void>,
): RequestHandler =>
	(req, res, next: NextFunction) => {
		fn(req, res).catch(next);
	};
