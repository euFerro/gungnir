# @bardjs/back

Declarative Express framework for Bard.js backend applications. Define your config, controllers, and modules — the framework handles everything else.

## Introduction

This framework was designed with the future of AI-assisted development in mind. As AI becomes a core part of how we build and maintain software, codebases need to be **readable, predictable, and consistent** — not just for humans, but for AI agents too.

Traditional Express apps scatter configuration, routing, error handling, logging, and rate limiting across dozens of files with imperative patterns that are hard to parse and reason about. This framework replaces all of that with a small set of declarative functions (`defineConfig`, `defineController`, `defineModule`) that make the entire application structure explicit and self-documenting.

**Why this matters for AI development:**

- **Consistency** — Every project follows the same patterns for config, routing, errors, and logging. An AI reading one project instantly understands all of them.
- **Declarative structure** — No hidden side effects, no imperative middleware chains to trace. The entire app is defined in ~3 function calls that AI can parse in a single pass.
- **Auto-generated documentation** — Every module gets a `/spec` route automatically. No manual docs to maintain or drift out of sync.
- **~60% fewer tokens** — A typical module definition in this framework is 15-20 lines of pure declarations vs. 50-60 lines of imperative Express code (router setup, middleware wiring, error handling, handler wrapping). AI agents spend significantly fewer tokens reading, understanding, and modifying the codebase.
- **Predictable error handling** — Throw an `HttpException` anywhere, the framework catches it. No more hunting for missing `try/catch` blocks or inconsistent error responses.

The result: a framework that is easier to write, easier to read, and easier to maintain — whether you're a human developer or an AI agent working on the code.

## Install

```bash
npm install @bardjs/back
```

**Peer dependency:** `express` ^4.0.0 || ^5.0.0

## Principles

### Depend on interfaces, not implementations

Services, repositories, gateways, and any other dependency should never receive or reference a concrete class directly. Always depend on an **interface** (contract) and inject the implementation.

```typescript
// ✅ Correct — depends on interface
class UsersService implements IUsersService {
  constructor(private readonly repository: IUsersRepository) {}
}

// ❌ Wrong — depends on concrete class
class UsersService {
  constructor(private readonly repository: UsersRepository) {}
}
```

This applies at every layer:
- **Controllers** depend on a service interface (`IUsersService`), never on `UsersService`
- **Services** depend on a repository interface (`IUsersRepository`), never on `UsersRepository`
- **Services** depend on gateway interfaces (`IPaymentGateway`), never on `StripeGateway`

This makes your code testable (swap real implementations for mocks), decoupled (change the database without touching the service), and explicit about its contracts.

## Quick Start

### Step 1 — Define your config

```typescript
// src/server.config.ts
import 'dotenv/config'; // side-effect — loads .env into process.env
import { defineConfig } from '@bardjs/back';

defineConfig({
  port: { env: 'PORT', default: 3000 },
  prefix: '/api',
  jsonLimit: '10mb',

  environments: {
    development: {
      endpoints: {
        usersApi: 'https://dev.api.example.com/users',
      },
    },
    staging: {
      endpoints: {
        usersApi: 'https://staging.api.example.com/users',
      },
    },
    production: {
      endpoints: {
        usersApi: 'https://api.example.com/users',
      },
    },
  },

  env: {
    DATABASE_URL: { required: true },
    JWT_SECRET: { required: true },
    MY_CUSTOM_ENV_VAR: { default: 'my_custom_env_var' },
  },
});
```

The framework validates required env vars on startup, resolves endpoints for the active environment (via `NODE_ENV`), and makes everything available through the `config` singleton. The `prefix` is prepended to all module routes automatically.

### Step 2 — Define a service

Define an interface for the contract and implement it with a plain class. Controllers depend on the interface, never on the implementation.

```typescript
// src/modules/users/services/users.services.ts
import { NotFoundException } from '@bardjs/back';

export interface IUsersService {
  findAll(params: PaginationParams): Promise<PaginatedResult<User>>;
  findById(id: string): Promise<User>;
  create(data: Partial<User>): Promise<User>;
}

class UsersService implements IUsersService {
  constructor(private readonly repository: IUsersRepository) {}

  async findAll(params: PaginationParams) {
    return this.repository.findAll(params);
  }

  async findById(id: string) {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: Partial<User>) {
    return this.repository.create(data);
  }
}
```

### Step 3 — Define controllers

```typescript
// src/modules/users/controllers/users.controllers.ts
import { defineController } from '@bardjs/back';
import type { IUsersService } from '../services/users.service';

export const listUsersController = defineController<IUsersService>({
  handler: async (req, res, service) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await service.findAll({ page, limit });
    res.json(result);
  },
  responses: {
    200: { description: 'Paginated list of users' },
  },
});

export const findUserController = defineController<IUsersService>({
  handler: async (req, res, service) => {
    const user = await service.findById(req.params.id);
    res.json({ data: user });
  },
  throttleConfig: { limit: 50, ttl: 60_000 },
  responses: {
    200: { description: 'User found' },
    404: { description: 'User not found' },
  },
});

export const createUserController = defineController<IUsersService>({
  handler: async (req, res, service) => {
    const user = await service.create(req.body);
    res.status(201).json({ data: user });
  },
  throttleConfig: 'STRICT',
  middlewares: [validateCreateUser],
  requestSchema: createUserSchema,
  responses: {
    201: { description: 'User created' },
    400: { description: 'Validation failed' },
  },
});
```

`defineController` is generic and returns a factory. Call the factory with your service implementation to get a `BardController`.

### Step 4 — Define a module

The module file is the **composition root** — you instantiate implementations, wire dependencies, and declare routes.

```typescript
// src/modules/users/users.module.ts
import { defineModule } from '@bardjs/back';
import { listUsersController, findUserController, createUserController } from './controllers/users.controllers';

const usersDb = new UsersPostgresDb();
const usersRepository = new UsersRepository(usersDb);
const usersService = new UsersService(usersRepository);

defineModule({
  name: 'UsersModule',
  prefix: '/users',
  routes: [
    { method: 'GET',  path: '/',    controller: listUsersController(usersService) },
    { method: 'GET',  path: '/:id', controller: findUserController(usersService) },
    { method: 'POST', path: '/',    controller: createUserController(usersService) },
  ],
});
```

Each controller factory is called with the service — you can see exactly which implementations are being used. Swap a database or service implementation by changing one line.

With `prefix: '/api'` in `defineConfig` and `prefix: '/users'` in the module, the framework generates these routes:

```
GET  /api/users
GET  /api/users/:id
POST /api/users
```

### Step 5 — Main

```typescript
// src/server.ts
import './server.config'; // side-effect — runs defineConfig()
import { app, config, logger } from '@bardjs/back';

const log = logger.child('Server');

const main = async () => {
  // Add any db connection or any other logic you need here...

  app.listen(() => {
    log.info(`${process.env.npm_package_name} v${process.env.npm_package_version} started`, {
      url: `http://localhost:${config.port}/`
    });
  });
};

main();
```

That's it. Config, logging, rate limiting, exception handling, and graceful shutdown — all automatic.

## API Summary

| Export | Type | Sync? | Description |
|--------|------|-------|-------------|
| `defineConfig()` | function | sync | Registers app config: port, prefix, env vars, environment endpoints |
| `defineController()` | function | sync | Generic factory — returns `ControllerFactory<TService>` |
| `defineModule()` | function | sync | Declares a module with routes. |
| `config` | singleton | — | Access resolved config: `config.port`, `config.env.X`, `config.endpoints.X` |
| `app` | singleton | — | Express app: `app.listen()`, `app.shutdown()`, `app.useMiddleware()` |
| `logger` | singleton | — | Colored logger: `logger.info()`, `logger.child('Context')` |
| `THROTTLE_CONFIG` | constant | — | Rate limit presets: `SECURITY`, `STRICT`, `STANDARD`, `PERMISSIVE`, `EXTRA_PERMISSIVE` |
| `*Exception` | classes | — | 14 HTTP exception classes (400–504). Throw anywhere, caught by framework |

**Lifecycle:** `defineConfig()` → `defineController()` → `defineModule()` → `app.listen()`

## Core API

### `defineConfig(options)`

Registers application configuration. Call once at the top of your entry point.

```typescript
import 'dotenv/config';
import { defineConfig } from '@bardjs/back';

defineConfig({
  port: 3000,                          // static number
  port: { env: 'PORT', default: 3000 },// or from env var with fallback
  prefix: '/api',                      // prepended to all module prefixes
  jsonLimit: '10mb',                   // Express JSON body limit

  environments: {                      // endpoint sets per NODE_ENV
    development: { endpoints: { api: 'https://dev.api.com' } },
    staging:     { endpoints: { api: 'https://staging.api.com' } },
    production:  { endpoints: { api: 'https://api.com' } },
  },

  env: {                               // custom env vars
    DB_URL: { required: true },        // throws on startup if missing
    MY_CUSTOM_ENV_VAR: { default: 'my_custom_env_var' },    // optional with default
  },
});
```

### `config`

Singleton with resolved configuration. Available after `defineConfig()`.

```typescript
import { config } from '@bardjs/back';

config.port                  // number
config.prefix                // string (e.g. '/api')
config.jsonLimit             // string
config.environment           // 'development' | 'staging' | 'production' | ...
config.endpoints.api         // resolved for active environment
config.env.DB_URL            // validated env var value
config.isProduction()        // boolean
```

### `defineController<TService>(options)`

Generic factory that returns a `ControllerFactory<TService>`. The handler receives `(req, res, service)` — the service is injected by `defineModule` at registration time.

```typescript
import { defineController } from '@bardjs/back';

const myController = defineController<IMyService>({
  handler: async (req, res, service) => {
    const result = await service.doSomething();
    res.json({ data: result });
  },
  throttleConfig: 'STANDARD',           // preset or { limit, ttl }
  middlewares: [validateBody, authGuard],// run before handler
  requestSchema: myRequestSchema,       // optional — included in /spec
  responses: {                          // optional — included in /spec
    200: { description: 'Success' },
    400: { description: 'Validation failed' },
  },
});
```

### `defineModule(options)`

Declares a module with routes. The module is queued and registered automatically when `app.listen()` is called. Routes receive built `BardController` instances — call your `defineController` factories with the service implementation in the routes array.

```typescript
import { defineModule } from '@bardjs/back';

const ordersService = new OrdersService(new OrdersRepository(db));

defineModule({
  name: 'OrdersModule',
  prefix: '/orders',
  routes: [
    { method: 'GET',  path: '/',    controller: listOrdersController(ordersService) },
    { method: 'GET',  path: '/:id', controller: findOrderController(ordersService) },
    { method: 'POST', path: '/',    controller: createOrderController(ordersService) },
  ],
  middlewares: [requireAuth],  // applied to all routes in this module
  destroy: async () => {       // called on graceful shutdown
    await closeConnections();
  },
});
```

### `app`

The application singleton. No need to instantiate — it's created by the framework.

```typescript
import { app } from '@bardjs/back';

// Add global middleware
app.useMiddleware(cors());

// Start the server (flushes all queued modules, then listens)
app.listen(() => { /* optional callback */ });

// Graceful shutdown (calls destroy() on all modules)
await app.shutdown(); // async — awaits all module destroy functions
```

### `logger`

Zero-dependency colored logger. Controlled by `APP_DEBUG_LEVEL` env var.

```typescript
import { logger } from '@bardjs/back';

logger.info('App started', { port: 3000 });

const log = logger.child('MyService');
log.debug('Processing', { id: '123' });
log.warn('Slow query', { duration: '500ms' });
log.error('Failed', { error: err });
```

**Log levels:** `debug` | `info` | `warn` | `error` | `silent`

- `NODE_ENV=production` defaults to `info`
- `NODE_ENV=test` defaults to `silent`
- Otherwise defaults to `debug`
- `APP_DEBUG_LEVEL` overrides all defaults

## What Happens Automatically

- **Request logging** — incoming/outgoing requests with method, URL, status, duration
- **Exception handling** — `HttpException` subclasses return structured JSON; unhandled errors return 500
- **Rate limiting** — every controller has per-IP throttling (configurable per controller)
- **Startup banner** — instance UID, port, environment, debug level, registered modules

```
14:32:05.123 INFO  [App] ----------------------------------------
14:32:05.123 INFO  [App] Server started at 2026-04-13T14:32:05.123Z
14:32:05.123 INFO  [App] Instance UID : a1b2c3d4-e5f6-7890-abcd-ef1234567890
14:32:05.123 INFO  [App] Port         : 3000
14:32:05.123 INFO  [App] Environment  : development
14:32:05.123 INFO  [App] Debug Level  : debug
14:32:05.123 INFO  [App] Modules      : 1 registered
14:32:05.123 INFO  [App]   -> UsersModule on /api/users
14:32:05.123 INFO  [App] ----------------------------------------
```

## Auto-Generated Spec Routes

Every module automatically gets a `GET /spec` route that returns a JSON description of its routes, including HTTP methods, paths, throttle configuration, and optional descriptions. A global `GET {prefix}/spec` route lists all registered modules.

### Per-module spec

```
GET /api/dce/spec
```

```json
{
  "module": "DceModule",
  "prefix": "/api/dce",
  "routes": [
    {
      "method": "POST",
      "path": "/autorizacao",
      "fullPath": "/api/dce/autorizacao",
      "description": "Autorizar nova DCe junto a SEFAZ",
      "throttle": { "preset": "STRICT", "limit": 10, "ttl": 60000 }
    },
    {
      "method": "GET",
      "path": "/status",
      "fullPath": "/api/dce/status",
      "throttle": { "preset": "STANDARD", "limit": 100, "ttl": 60000 }
    }
  ]
}
```

### Global spec

```
GET /api/spec
```

```json
{
  "modules": [
    { "name": "AppModule", "prefix": "/api", "routes": [...] },
    { "name": "DceModule", "prefix": "/api/dce", "routes": [...] }
  ]
}
```

### Adding descriptions to routes

Pass an optional `description` to any route in `defineModule`:

```typescript
defineModule({
  name: 'DceModule',
  prefix: '/dce',
  routes: [
    {
      method: 'POST',
      path: '/autorizacao',
      controller: criarAutorizacaoController(dceService),
      description: 'Autorizar nova DCe junto a SEFAZ',
    },
  ],
});
```

### Using spec for AI-assisted development

The `/spec` endpoint is a machine-readable contract of your entire API. You can use it to accelerate AI-assisted development:

- **Client generation** — Pass the spec JSON to an AI in plan mode and ask it to generate a typed HTTP client, SDK, or frontend service layer. The AI has every route, method, path, and rate limit — it can produce deterministic, correct code without reading the server source.
- **Test generation** — Give the spec to an AI and ask it to generate integration tests for every endpoint. The throttle config tells it exactly how many requests it can make before hitting 429.
- **Documentation** — Feed the spec into an AI to generate human-readable API docs, Postman collections, or OpenAPI schemas.
- **Cross-service contracts** — When building microservices, the spec of one service can be passed to an AI building another service's client. The contract is always up-to-date because it's generated from the actual running code.
- **Code review** — An AI reviewing a PR can fetch `/spec` before and after the change to understand exactly what API surface changed.

Since the spec is auto-generated from your `defineModule` and `defineController` declarations, it never drifts out of sync with the actual implementation. It's the single source of truth for your API surface.

## Rate Limiting

Every controller has built-in per-IP rate limiting. Configure via `throttleConfig` in `defineController`.

| Preset | Limit | TTL | Use case |
|---|---|---|---|
| `SECURITY` | 5 req | 60s | Login, password reset, MFA |
| `STRICT` | 10 req | 60s | Write operations, payments |
| `STANDARD` | 100 req | 60s | General API endpoints (default) |
| `PERMISSIVE` | 1,000 req | 60s | High-traffic reads |
| `EXTRA_PERMISSIVE` | 10,000 req | 60s | Public assets, health checks |

When a client exceeds the limit, the framework returns HTTP 429 with a `Retry-After` header. Every response includes `X-RateLimit-Remaining`.

Custom config:

```typescript
defineController({
  handler: myHandler,
  throttleConfig: { limit: 3, ttl: 300_000 }, // 3 requests per 5 minutes
});
```

## Middleware

### Per-Controller

```typescript
defineController({
  handler: async (req, res) => { /* ... */ },
  middlewares: [requireAuth, validateBody],
});
```

Middlewares run after rate limiting and before the handler. If a middleware throws an `HttpException`, the chain stops.

### Per-Module

```typescript
defineModule({
  name: 'AdminModule',
  prefix: '/admin',
  routes: [/* ... */],
  middlewares: [requireAuth], // applied to all routes
});
```

## Exceptions

Throw anywhere in handlers or middleware — the framework catches and formats the response.

```typescript
import { NotFoundException, BadRequestException } from '@bardjs/back';

throw new NotFoundException('Order not found');
// -> 404 { "error": "Order not found" }

throw new BadRequestException('Invalid email');
// -> 400 { "error": "Invalid email" }
```

| Class | Status |
|---|---|
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `GoneException` | 410 |
| `PayloadTooLargeException` | 413 |
| `UnprocessableEntityException` | 422 |
| `TooManyRequestsException` | 429 |
| `InternalServerErrorException` | 500 |
| `NotImplementedException` | 501 |
| `BadGatewayException` | 502 |
| `ServiceUnavailableException` | 503 |
| `GatewayTimeoutException` | 504 |

## Project Structure

```
src/
  server.config.ts              # defineConfig()
  server.ts                     # main + app.listen()
  modules/
    users/
      users.module.ts           # defineModule()
      controllers/
        users.controllers.ts    # defineController() factories
      middlewares/
        users.middlewares.ts     # Zod validation, auth guards
      services/
        users.service.ts        # implements IUsersService
        users.service.interface.ts
      repositories/
        users.repository.ts     # implements IUsersRepository
      schemas/
        users.schemas.ts        # Zod schemas
```

## Development

```bash
npm run build     # Compile TypeScript
npm run dev       # Watch mode
npm test          # Run tests
npm publish       # Publish to registry
```
