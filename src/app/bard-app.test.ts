import { BardApp, BardExpressApp } from './bard-app';
import { BardModule } from '../core/bard-module';

describe('BardApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an app with default options', () => {
      // Arrange & Act
      const app = new BardApp();

      // Assert
      expect(app.serverInstanceUid).toBeDefined();
      expect(app.serverInstanceUid).toHaveLength(36);
    }, 1000);
  });

  describe('serverInstanceUid', () => {
    it('should generate unique UIDs for each instance', () => {
      // Arrange & Act
      const app1 = new BardApp();
      const app2 = new BardApp();

      // Assert
      expect(app1.serverInstanceUid).not.toBe(app2.serverInstanceUid);
    }, 1000);
  });

  describe('registerModule', () => {
    it('should call register on the module', async () => {
      // Arrange
      const registerFn = jest.fn();
      const mod = new BardModule(registerFn, { name: 'TestModule' });
      const app = new BardApp();

      // Act
      await app.registerModule('/test', mod);

      // Assert
      expect(registerFn).toHaveBeenCalledWith(mod.router);
    }, 1000);

    it('should return the app instance for chaining', async () => {
      // Arrange
      const mod = new BardModule(jest.fn());
      const app = new BardApp();

      // Act
      const result = await app.registerModule('/test', mod);

      // Assert
      expect(result).toBe(app);
    }, 1000);
  });

  describe('shutdown', () => {
    it('should call destroy on all registered modules', async () => {
      // Arrange
      const destroyFn1 = jest.fn();
      const destroyFn2 = jest.fn();
      const mod1 = new BardModule(jest.fn(), { destroy: destroyFn1 });
      const mod2 = new BardModule(jest.fn(), { destroy: destroyFn2 });
      const app = new BardApp();
      await app.registerModule('/a', mod1);
      await app.registerModule('/b', mod2);

      // Act
      await app.shutdown();

      // Assert
      expect(destroyFn1).toHaveBeenCalled();
      expect(destroyFn2).toHaveBeenCalled();
    }, 1000);

    it('should not throw when no modules are registered', async () => {
      // Arrange
      const app = new BardApp();

      // Act & Assert
      await expect(app.shutdown()).resolves.toBeUndefined();
    }, 1000);
  });

  describe('getExpressApp', () => {
    it('should return the underlying Express app', () => {
      // Arrange
      const app = new BardApp();

      // Act
      const expressApp = app.getExpressApp();

      // Assert
      expect(expressApp).toBeDefined();
      expect(typeof expressApp.use).toBe('function');
    }, 1000);
  });

  describe('useMiddleware', () => {
    it('should add middleware to the Express app', () => {
      // Arrange
      const app = new BardApp();
      const middleware = jest.fn();

      // Act
      const result = app.useMiddleware(middleware);

      // Assert
      expect(result).toBe(app);
    }, 1000);
  });

  describe('useRouter', () => {
    it('should return the app instance for chaining', () => {
      // Arrange
      const app = new BardApp();
      const { Router } = require('express');
      const router = Router();

      // Act
      const result = app.useRouter('/api', router);

      // Assert
      expect(result).toBe(app);
    }, 1000);
  });

  describe('backward compatibility', () => {
    it('should export BardExpressApp as alias for BardApp', () => {
      // Assert
      expect(BardExpressApp).toBe(BardApp);
    }, 1000);
  });
});
