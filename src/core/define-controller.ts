import { GungnirController } from './gungnir-controller';
import type { ResponseDefinition } from './gungnir-controller';
import type { Request, Response, RequestHandler } from 'express';
import type { ThrottlePreset, ThrottleConfig } from '../throttle/throttle.constants';

export type ServiceRouteHandler<TService> = (req: Request, res: Response, service: TService) => Promise<void> | void;

export type ControllerFactory<TService> = (service: TService) => GungnirController;

export interface DefineControllerOptions<TService> {
  handler: ServiceRouteHandler<TService>;
  /** Rate-limit preset name or custom config. Defaults to 'STANDARD'. */
  throttleConfig?: ThrottlePreset | ThrottleConfig;
  /** Express middlewares to run after rate limiting and before the handler. */
  middlewares?: ReadonlyArray<RequestHandler>;
  /** Request schema for spec generation. Pass a Zod schema or any describable object. */
  requestSchema?: unknown;
  /** Response definitions by status code for spec generation. */
  responses?: Record<number, ResponseDefinition>;
}

/**
 * Generic controller factory. Returns a function that, when called with
 * a service instance, produces a configured GungnirController.
 *
 * The handler receives (req, res, service) — no need for manual closure wiring.
 * Used with defineModule, which injects the service automatically.
 */
export const defineController = <TService>(
  options: DefineControllerOptions<TService>,
): ControllerFactory<TService> => {
  return (service: TService) => {
    const { handler, ...controllerOptions } = options;
    return new GungnirController(
      (req, res) => handler(req, res, service),
      controllerOptions,
    );
  };
};
