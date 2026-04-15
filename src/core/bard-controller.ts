import type { Request, Response, RequestHandler, NextFunction } from 'express';
import { TooManyRequestsException } from '../exceptions/http.exception';
import { ControllerThrottler } from '../throttle/controller-throttler';
import { THROTTLE_CONFIG } from '../throttle/throttle.constants';
import type { ThrottleConfig, ThrottlePreset } from '../throttle/throttle.constants';

export type RouteHandler = (req: Request, res: Response) => Promise<void> | void;

export interface ResponseDefinition {
  description: string;
}

export interface ControllerOptions {
  /** Rate-limit preset name or custom config. Defaults to 'STANDARD'. */
  throttleConfig?: ThrottlePreset | ThrottleConfig;
  /** Express middlewares to run after rate limiting and before the handler. */
  middlewares?: ReadonlyArray<RequestHandler>;
  /** Request schema object for spec generation. Pass a Zod schema or any object with a describable shape. */
  requestSchema?: unknown;
  /** Response definitions by status code for spec generation. */
  responses?: Record<number, ResponseDefinition>;
}

export interface ControllerMetadata {
  throttlePreset: string | null;
  throttleConfig: ThrottleConfig;
  requestSchema?: unknown;
  responses?: Record<number, ResponseDefinition>;
}

/**
 * Runs a single Express middleware as a promise.
 * Returns true if next() was called (continue chain), false otherwise (response sent).
 */
function runMiddleware(mw: RequestHandler, req: Request, res: Response): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    let settled = false;

    const next: NextFunction = (err?: unknown) => {
      if (settled) return;
      settled = true;
      if (err) return reject(err instanceof Error ? err : new Error(String(err)));
      resolve(true);
    };

    try {
      const result = mw(req, res, next);
      if (result instanceof Promise) {
        result.then(() => {
          if (settled) return;
          settled = true;
          resolve(false);
        }).catch(reject);
        return;
      }
    } catch (error) {
      reject(error);
      return;
    }

    if (!settled) {
      settled = true;
      resolve(false);
    }
  });
}

export class BardController {
  private readonly handleFn: RouteHandler;
  private readonly throttleConfig: ThrottlePreset | ThrottleConfig;
  private readonly middlewares: ReadonlyArray<RequestHandler>;
  private readonly _requestSchema?: unknown;
  private readonly _responses?: Record<number, ResponseDefinition>;
  private _throttler?: ControllerThrottler;

  constructor(handler: RouteHandler, options?: ControllerOptions) {
    this.handleFn = handler;
    this.throttleConfig = options?.throttleConfig ?? 'STANDARD';
    this.middlewares = options?.middlewares ?? [];
    this._requestSchema = options?.requestSchema;
    this._responses = options?.responses;
  }

  /** Exposes throttle config for spec generation */
  get metadata(): ControllerMetadata {
    const isPreset = typeof this.throttleConfig === 'string';
    const resolved = isPreset
      ? THROTTLE_CONFIG[this.throttleConfig as ThrottlePreset]
      : this.throttleConfig;
    const meta: ControllerMetadata = {
      throttlePreset: isPreset ? (this.throttleConfig as string) : null,
      throttleConfig: resolved,
    };
    if (this._requestSchema) meta.requestSchema = this._requestSchema;
    if (this._responses) meta.responses = this._responses;
    return meta;
  }

  private get throttler(): ControllerThrottler {
    if (!this._throttler) {
      const config = typeof this.throttleConfig === 'string'
        ? THROTTLE_CONFIG[this.throttleConfig]
        : this.throttleConfig;
      this._throttler = new ControllerThrottler(config);
    }
    return this._throttler;
  }

  /** Bound handler with rate limiting and middleware chain, ready for Express router */
  get handler(): RouteHandler {
    return async (req: Request, res: Response) => {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

      if (!this.throttler.check(ip)) {
        res.setHeader('Retry-After', String(this.throttler.retryAfter(ip)));
        throw new TooManyRequestsException();
      }

      res.setHeader('X-RateLimit-Remaining', String(this.throttler.remaining(ip)));

      for (const mw of this.middlewares) {
        const shouldContinue = await runMiddleware(mw, req, res);
        if (!shouldContinue) return;
      }

      await this.handleFn(req, res);
    };
  }
}
