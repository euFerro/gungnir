# Modules

## `defineModule(options)`

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

## Per-Module Middleware

```typescript
defineModule({
  name: 'AdminModule',
  prefix: '/admin',
  routes: [/* ... */],
  middlewares: [requireAuth], // applied to all routes
});
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
