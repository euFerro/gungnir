# Controllers

## `defineController<TService>(options)`

Generic factory that returns a `ControllerFactory<TService>`. The handler receives `(req, res, service)` — the service is injected when the factory is called in the module file.

```typescript
import { defineController } from '@bardjs/back';

const myController = defineController<IMyService>({
  handler: async (req, res, service) => {
    const result = await service.doSomething();
    res.json({ data: result });
  },
  throttleConfig: 'STANDARD',           // preset or { limit, ttl }
  middlewares: [validateBody, authGuard],// run before handler
  requestSchema: myRequestSchema,       // optional — included in /spec output
  responses: {                          // optional — included in /spec output
    200: { description: 'Success' },
    400: { description: 'Validation failed' },
    404: { description: 'Not found' },
  },
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `handler` | `(req, res, service) => void` | yes | Request handler with injected service |
| `throttleConfig` | `ThrottlePreset \| { limit, ttl }` | no | Rate limit config. Defaults to `'STANDARD'` |
| `middlewares` | `RequestHandler[]` | no | Run after rate limiting, before handler |
| `requestSchema` | `unknown` | no | Request schema for `/spec` route (e.g. Zod schema) |
| `responses` | `Record<number, { description }>` | no | Response docs by status code for `/spec` route |

## Error Metadata

When throwing `HttpException` subclasses, you can pass an optional `metadata` object that's included in the error response:

```typescript
throw new NotFoundException('User not found', {
  code: 'USER_NOT_FOUND',
  userId: '123',
});
// Response: { "error": "User not found", "metadata": { "code": "USER_NOT_FOUND", "userId": "123" } }
```

If no metadata is passed, the response is just `{ "error": "message" }`.

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
