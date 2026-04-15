import { randomUUID } from 'crypto';
import express, { Express, Router } from 'express';
import { globalExceptionMiddleware } from '../middlewares/global-exception.middleware';
import { requestInterceptorMiddleware } from '../middlewares/request-interceptor.middleware';
import { BardModule } from '../core/bard-module';
import { logger } from '../logger/bard-logger';
import { config } from '../config/bard-config';
import { flushPendingModules } from '../core/define-module';
import type { DefineModuleOptions } from '../core/define-module';

const log = logger.child('App');

export interface BardAppOptions {
  port?: number;
  cors?: boolean;
  jsonLimit?: string;
}

interface RegisteredModuleSpec {
  name: string;
  prefix: string;
  routes: {
    method: string;
    path: string;
    fullPath: string;
    description?: string;
    throttle: {
      preset: string | null;
      limit: number;
      ttl: number;
    };
    requestSchema?: unknown;
    responses?: Record<number, { description: string }>;
  }[];
}

export class BardApp {
  public readonly serverInstanceUid: string = randomUUID();
  private app: Express;
  private options: BardAppOptions;
  private modules: { prefix: string; module: BardModule }[] = [];
  private moduleSpecs: RegisteredModuleSpec[] = [];
  private initialized = false;

  constructor(options: BardAppOptions = {}) {
    this.app = express();
    this.options = options;
    this.app.use(requestInterceptorMiddleware);
  }

  /** Lazily apply config-dependent middleware (called once before listen) */
  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;

    const jsonLimit = this.options.jsonLimit || (config.isInitialized() ? config.jsonLimit : '10mb');
    this.app.use(express.json({ limit: jsonLimit }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  /** Register a module: calls register(), mounts its router, tracks for shutdown */
  async registerModule(prefix: string, module: BardModule): Promise<this> {
    this.ensureInit();
    await module.register();
    this.app.use(prefix, module.router);
    this.modules.push({ prefix, module });
    return this;
  }

  public useRouter(prefix: string, router: Router): this {
    this.app.use(prefix, router);
    return this;
  }

  public useMiddleware(...handlers: express.RequestHandler[]): this {
    handlers.forEach((h) => this.app.use(h));
    return this;
  }

  /** Normalize paths to avoid double slashes */
  private normalizePath(path: string): string {
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  /** Build spec metadata from module options */
  private buildModuleSpec(options: DefineModuleOptions, fullPrefix: string): RegisteredModuleSpec {
    const normalizedPrefix = this.normalizePath(fullPrefix);
    return {
      name: options.name,
      prefix: normalizedPrefix,
      routes: options.routes.map((route) => {
        const meta = route.controller.metadata;
        const spec: RegisteredModuleSpec['routes'][number] = {
          method: route.method,
          path: route.path,
          fullPath: this.normalizePath(normalizedPrefix + route.path),
          description: route.description,
          throttle: {
            preset: meta.throttlePreset,
            limit: meta.throttleConfig.limit,
            ttl: meta.throttleConfig.ttl,
          },
        };
        if (meta.requestSchema) spec.requestSchema = meta.requestSchema;
        if (meta.responses) spec.responses = meta.responses;
        return spec;
      }),
    };
  }

  public listen(callback?: () => void): void {
    this.ensureInit();

    // Flush all modules queued via defineModule()
    const pending = flushPendingModules();

    // Build specs first so global route has all data
    const builtModules: { module: BardModule; fullPrefix: string; spec: RegisteredModuleSpec }[] = [];
    for (const options of pending) {
      const module = new BardModule(
        (router) => {
          for (const route of options.routes) {
            const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
            router[method](route.path, route.controller.handler);
          }
        },
        {
          name: options.name,
          destroy: options.destroy,
          middlewares: options.middlewares,
        },
      );

      const fullPrefix = this.normalizePath(config.prefix + options.prefix);
      const spec = this.buildModuleSpec(options, fullPrefix);
      this.moduleSpecs.push(spec);

      // Auto-add per-module /spec route
      module.router.get('/spec', (_req, res) => {
        res.json(spec);
      });

      builtModules.push({ module, fullPrefix, spec });
    }

    // Global /spec route — registered before modules so it doesn't get shadowed
    const globalPrefix = config.isInitialized() ? config.prefix : '';
    const allSpecs = this.moduleSpecs;
    this.app.get(this.normalizePath(`${globalPrefix}/spec`), (_req, res) => {
      res.json({ modules: allSpecs });
    });

    // Now register all modules
    for (const { module, fullPrefix } of builtModules) {
      module.register();
      this.app.use(fullPrefix, module.router);
      this.modules.push({ prefix: fullPrefix, module });
    }

    const port = this.options.port || (config.isInitialized() ? config.port : 3000);

    // Global exception handler (must be last middleware)
    this.app.use(globalExceptionMiddleware);

    this.app.listen(port, () => {
      const env = process.env.NODE_ENV || 'development';
      const debugLevel = process.env.APP_DEBUG_LEVEL || (env === 'production' ? 'info' : 'debug');

      log.info('----------------------------------------');
      log.info(`Server started at ${new Date().toISOString()}`);
      log.info(`Instance UID : ${this.serverInstanceUid}`);
      log.info(`Port         : ${port}`);
      log.info(`Environment  : ${env}`);
      log.info(`Debug Level  : ${debugLevel}`);
      log.info(`Modules      : ${this.modules.length} registered`);
      this.modules.forEach(({ prefix, module }) => {
        log.info(`  -> ${module.name} on ${prefix || '/'}`);
      });
      log.info('----------------------------------------');

      if (callback) callback();
    });
  }

  /** Graceful shutdown: calls destroy() on all registered modules */
  async shutdown(): Promise<void> {
    log.info('Shutting down...');
    await Promise.all(this.modules.map(({ module }) => module.destroy()));
    log.info('Shutdown complete');
  }

  getExpressApp(): Express {
    return this.app;
  }
}

/** @deprecated Use BardApp instead */
export const BardExpressApp = BardApp;

// -- Singleton --
export const app = new BardApp();
