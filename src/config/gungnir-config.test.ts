import { GungnirConfig, defineConfig, config } from './gungnir-config';

describe('GungnirConfig', () => {
  let GungnirConfig: GungnirConfig;

  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    GungnirConfig = new GungnirConfig();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('init', () => {
    it('should initialize with default values when no options given', () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      GungnirConfig.init({});

      // Assert
      expect(GungnirConfig.port).toBe(3000);
      expect(GungnirConfig.jsonLimit).toBe('10mb');
      expect(GungnirConfig.environment).toBe('development');
      expect(GungnirConfig.isInitialized()).toBe(true);
    });

    it('should only initialize once', () => {
      // Arrange & Act
      GungnirConfig.init({ port: 4000 });
      GungnirConfig.init({ port: 5000 });

      // Assert
      expect(GungnirConfig.port).toBe(4000);
    });

    it('should resolve port from static number', () => {
      // Arrange & Act
      GungnirConfig.init({ port: 8080 });

      // Assert
      expect(GungnirConfig.port).toBe(8080);
    });

    it('should resolve port from env var with fallback to default', () => {
      // Arrange
      process.env.PORT = '9090';

      // Act
      GungnirConfig.init({ port: { env: 'PORT', default: 3000 } });

      // Assert
      expect(GungnirConfig.port).toBe(9090);
    });

    it('should use default port when env var is not set', () => {
      // Arrange
      delete process.env.PORT;

      // Act
      GungnirConfig.init({ port: { env: 'PORT', default: 6767 } });

      // Assert
      expect(GungnirConfig.port).toBe(6767);
    });

    it('should set jsonLimit', () => {
      // Arrange & Act
      GungnirConfig.init({ jsonLimit: '50mb' });

      // Assert
      expect(GungnirConfig.jsonLimit).toBe('50mb');
    });

    it('should set prefix', () => {
      // Arrange & Act
      GungnirConfig.init({ prefix: '/api' });

      // Assert
      expect(GungnirConfig.prefix).toBe('/api');
    });

    it('should default prefix to empty string', () => {
      // Arrange & Act
      GungnirConfig.init({});

      // Assert
      expect(GungnirConfig.prefix).toBe('');
    });
  });

  describe('env', () => {
    it('should collect env vars with values', () => {
      // Arrange
      process.env.DB_URL = 'postgres://localhost/test';

      // Act
      GungnirConfig.init({
        env: { DB_URL: { required: true } },
      });

      // Assert
      expect(GungnirConfig.env.DB_URL).toBe('postgres://localhost/test');
    });

    it('should use default when env var is not set', () => {
      // Arrange
      delete process.env.DB_POOL;

      // Act
      GungnirConfig.init({
        env: { DB_POOL: { default: '10' } },
      });

      // Assert
      expect(GungnirConfig.env.DB_POOL).toBe('10');
    });

    it('should throw when required env var is missing', () => {
      // Arrange
      delete process.env.SECRET_KEY;

      // Act & Assert
      expect(() =>
        GungnirConfig.init({
          env: { SECRET_KEY: { required: true } },
        }),
      ).toThrow('Missing required environment variable: SECRET_KEY');
    });

    it('should not throw when required env var is present', () => {
      // Arrange
      process.env.SECRET_KEY = 'my-secret';

      // Act & Assert
      expect(() =>
        GungnirConfig.init({
          env: { SECRET_KEY: { required: true } },
        }),
      ).not.toThrow();
    });
  });

  describe('environments', () => {
    const environments = {
      development: {
        endpoints: {
          api: 'https://dev.example.com/api',
          auth: 'https://dev.example.com/auth',
        },
      },
      production: {
        endpoints: {
          api: 'https://example.com/api',
          auth: 'https://example.com/auth',
        },
      },
    };

    it('should resolve endpoints for development by default', () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      GungnirConfig.init({ environments });

      // Assert
      expect(GungnirConfig.endpoints.api).toBe('https://dev.example.com/api');
      expect(GungnirConfig.endpoints.auth).toBe('https://dev.example.com/auth');
    });

    it('should resolve endpoints for production when NODE_ENV is production', () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      GungnirConfig.init({ environments });

      // Assert
      expect(GungnirConfig.endpoints.api).toBe('https://example.com/api');
      expect(GungnirConfig.endpoints.auth).toBe('https://example.com/auth');
    });

    it('should fallback to development when NODE_ENV is unknown', () => {
      // Arrange
      process.env.NODE_ENV = 'staging';

      // Act
      GungnirConfig.init({ environments });

      // Assert
      expect(GungnirConfig.endpoints.api).toBe('https://dev.example.com/api');
    });
  });

  describe('helpers', () => {
    it('should return true for isProduction when NODE_ENV is production', () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      GungnirConfig.init({});

      // Assert
      expect(GungnirConfig.isProduction()).toBe(true);
    });

    it('should return false for isProduction when NODE_ENV is development', () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      GungnirConfig.init({});

      // Assert
      expect(GungnirConfig.isProduction()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      // Arrange
      GungnirConfig.init({ port: 9999, jsonLimit: '50mb' });

      // Act
      GungnirConfig.reset();

      // Assert
      expect(GungnirConfig.port).toBe(3000);
      expect(GungnirConfig.jsonLimit).toBe('10mb');
      expect(GungnirConfig.isInitialized()).toBe(false);
    });
  });
});

describe('defineConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    config.reset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should initialize the global config singleton', () => {
    // Arrange
    process.env.MY_VAR = 'hello';

    // Act
    defineConfig({
      port: 4000,
      env: { MY_VAR: { required: true } },
    });

    // Assert
    expect(config.port).toBe(4000);
    expect(config.env.MY_VAR).toBe('hello');
    expect(config.isInitialized()).toBe(true);
  });
});