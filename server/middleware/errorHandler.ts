import { Request, Response, NextFunction } from "express";

export interface CustomError extends Error {
  status?: number;
}

export function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  console.error(`[Express Error Handler] Caught unhandled exception:`, err);

  const status = err.status || 500;
  const message = err.message || "An unexpected error occurred on the server.";

  res.status(status).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}
