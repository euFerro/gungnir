import type { RequestHandler } from 'express';
import { BardController } from './bard-controller';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  controller: BardController;
  /** Human-readable description for auto-generated /spec route */
  description?: string;
}

export interface DefineModuleOptions {
  name: string;
  prefix: string;
  routes: RouteDefinition[];
  /** Express middlewares applied to all routes in this module */
  middlewares?: ReadonlyArray<RequestHandler>;
  /** Called on graceful shutdown. Clean up intervals, connections, etc. */
  destroy?: () => Promise<void> | void;
}

/** Internal queue — flushed by BardApp.listen() */
const pendingModules: DefineModuleOptions[] = [];

/** Returns and clears the pending module queue. Called by BardApp.listen(). */
export const flushPendingModules = (): DefineModuleOptions[] => {
  const modules = [...pendingModules];
  pendingModules.length = 0;
  return modules;
};

/**
 * Declares a module with declarative route definitions.
 * The module is queued and registered automatically when app.listen() is called.
 *
 * Synchronous — no await needed. Same pattern as defineConfig.
 */
export const defineModule = (options: DefineModuleOptions): void => {
  pendingModules.push(options);
};
