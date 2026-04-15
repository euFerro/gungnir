import { Request, Response, NextFunction } from 'express';
import { HttpException } from '../exceptions/http.exception';
import { logger } from '../logger/bard-logger';

const log = logger.child('Exception');

export function globalExceptionMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpException) {
    log.warn(err.message, { statusCode: err.statusCode, ...(err.metadata ?? {}) });

    const body: Record<string, unknown> = { error: err.message };
    if (err.metadata) body.metadata = err.metadata;

    res.status(err.statusCode).json(body);
    return;
  }

  log.error(err.message, { stack: err.stack?.split('\n')[1]?.trim() });
  res.status(500).json({ error: 'Internal Server Error' });
}
