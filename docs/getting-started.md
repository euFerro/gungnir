# Getting Started

## Step 1 — Define your config

```typescript
// src/server.config.ts
import 'dotenv/config'; // side-effect — loads .env into process.env
import { defineConfig } from '@gungnir/back';

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

## Step 2 — Define a service

Define an interface for the contract and implement it with a plain class. Controllers depend on the interface, never on the implementation.

```typescript
// src/modules/users/services/users.services.ts
import { NotFoundException } from '@gungnir/back';

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

## Step 3 — Define controllers

```typescript
// src/modules/users/controllers/users.controllers.ts
import { defineController } from '@gungnir/back';
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

`defineController` is generic and returns a factory. Call the factory with your service implementation to get a `GungnirController`.

## Step 4 — Define a module

The module file is the **composition root** — you instantiate implementations, wire dependencies, and declare routes.

```typescript
// src/modules/users/users.module.ts
import { defineModule } from '@gungnir/back';
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

## Step 5 — Main

```typescript
// src/server.ts
import './server.config'; // side-effect — runs defineConfig()
import { app, config, logger } from '@gungnir/back';

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
