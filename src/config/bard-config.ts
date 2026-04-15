export interface EnvVarDefinition {
  required?: boolean;
  default?: string;
}

export interface EnvironmentConfig {
  endpoints: Record<string, string>;
}

export interface DefineConfigOptions {
  port?: number | { env: string; default: number };
  prefix?: string;
  jsonLimit?: string;
  environments?: Record<string, EnvironmentConfig>;
  env?: Record<string, EnvVarDefinition>;
}

export class BardConfig {
  private _port: number = 3000;
  private _prefix: string = '';
  private _jsonLimit: string = '10mb';
  private _env: Record<string, string> = {};
  private _endpoints: Record<string, string> = {};
  private _initialized = false;
  private _environment: string = 'development';

  init(options: DefineConfigOptions): void {
    if (this._initialized) return;

    this._environment = process.env.NODE_ENV || 'development';

    // Resolve port
    if (typeof options.port === 'object') {
      this._port = Number(process.env[options.port.env]) || options.port.default;
    } else if (typeof options.port === 'number') {
      this._port = options.port;
    }

    if (options.prefix) {
      this._prefix = options.prefix;
    }

    if (options.jsonLimit) {
      this._jsonLimit = options.jsonLimit;
    }

    // Validate & collect env vars
    if (options.env) {
      for (const [key, def] of Object.entries(options.env)) {
        const value = process.env[key] ?? def.default;
        if (def.required && !value) {
          throw new Error(`Missing required environment variable: ${key}`);
        }
        if (value) this._env[key] = value;
      }
    }

    // Resolve endpoints for active environment
    if (options.environments) {
      const activeEnv = options.environments[this._environment]
        ?? options.environments['development'];
      if (activeEnv?.endpoints) {
        this._endpoints = { ...activeEnv.endpoints };
      }
    }

    this._initialized = true;
  }

  /** Reset config state (for testing only) */
  reset(): void {
    this._port = 3000;
    this._prefix = '';
    this._jsonLimit = '10mb';
    this._env = {};
    this._endpoints = {};
    this._initialized = false;
    this._environment = 'development';
  }

  get port(): number { return this._port; }
  get prefix(): string { return this._prefix; }
  get jsonLimit(): string { return this._jsonLimit; }
  get env(): Record<string, string> { return this._env; }
  get endpoints(): Record<string, string> { return this._endpoints; }
  get environment(): string { return this._environment; }

  isProduction(): boolean { return this._environment === 'production'; }
  isInitialized(): boolean { return this._initialized; }
}

// Singleton
export const config = new BardConfig();

export const defineConfig = (options: DefineConfigOptions): void => {
  config.init(options);
};
