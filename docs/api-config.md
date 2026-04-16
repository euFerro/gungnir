# Configuration

## `defineConfig(options)`

Registers application configuration. Call once at the top of your entry point.

```typescript
import 'dotenv/config';
import { defineConfig } from '@gungnir/back';

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

## `config`

Singleton with resolved configuration. Available after `defineConfig()`.

```typescript
import { config } from '@gungnir/back';

config.port                  // number
config.prefix                // string (e.g. '/api')
config.jsonLimit             // string
config.environment           // 'development' | 'staging' | 'production' | ...
config.endpoints.api         // resolved for active environment
config.env.DB_URL            // validated env var value
config.isProduction()        // boolean
```
