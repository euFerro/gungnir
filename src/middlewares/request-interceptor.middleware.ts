import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger/gungnir-logger';

const log = logger.child('HTTP');

export function requestInterceptorMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const method = req.method;
  const url = req.originalUrl;

  // Log incoming request immediately (visible even if handler hangs)
  log.info(`--> ${method} ${url}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const meta = { status, duration: `${duration}ms` };

    if (status >= 500) {
      log.error(`<-- ${method} ${url}`, meta);
    } else if (status >= 400) {
      log.warn(`<-- ${method} ${url}`, meta);
    } else {
      log.info(`<-- ${method} ${url}`, meta);
    }
  });

  next();
}
