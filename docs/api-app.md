# App

## `app`

The application singleton. No need to instantiate — it's created by the framework.

```typescript
import { app } from '@gungnir/back';

// Add global middleware
app.useMiddleware(cors());

// Start the server (flushes all queued modules, then listens)
app.listen(() => { /* optional callback */ });

// Graceful shutdown (calls destroy() on all modules)
await app.shutdown(); // async — awaits all module destroy functions
```

## `logger`

Zero-dependency colored logger. Controlled by `APP_DEBUG_LEVEL` env var.

```typescript
import { logger } from '@gungnir/back';

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
