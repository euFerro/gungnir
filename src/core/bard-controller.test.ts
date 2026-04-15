import type { Request, Response, NextFunction } from 'express';
import { BardController } from './bard-controller';
import { TooManyRequestsException } from '../exceptions/http.exception';

const makeReq = (overrides: Partial<Request> = {}): Request =>
  ({ ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' }, ...overrides } as unknown as Request);

const makeRes = (): Response => {
  const headers: Record<string, string> = {};
  return {
    setHeader: jest.fn((key: string, value: string) => { headers[key] = value; }),
    getHeader: jest.fn((key: string) => headers[key]),
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
};

describe('BardController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handler', () => {
    it('should call the handler function', async () => {
      // Arrange
      const handlerFn = jest.fn();
      const controller = new BardController(handlerFn);
      const req = makeReq();
      const res = makeRes();

      // Act
      await controller.handler(req, res);

      // Assert
      expect(handlerFn).toHaveBeenCalledWith(req, res);
    }, 1000);

    it('should set X-RateLimit-Remaining header', async () => {
      // Arrange
      const controller = new BardController(jest.fn(), { throttleConfig: { limit: 10, ttl: 60_000 } });
      const req = makeReq();
      const res = makeRes();

      // Act
      await controller.handler(req, res);

      // Assert
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
    }, 1000);

    it('should throw TooManyRequestsException when rate limited', async () => {
      // Arrange
      const controller = new BardController(jest.fn(), { throttleConfig: { limit: 1, ttl: 60_000 } });
      const req = makeReq();
      const res = makeRes();
      await controller.handler(req, res);

      // Act & Assert
      await expect(controller.handler(req, makeRes())).rejects.toThrow(TooManyRequestsException);
    }, 1000);

    it('should set Retry-After header when rate limited', async () => {
      // Arrange
      const controller = new BardController(jest.fn(), { throttleConfig: { limit: 1, ttl: 60_000 } });
      const req = makeReq();
      const res = makeRes();
      await controller.handler(req, res);

      // Act
      const res2 = makeRes();
      try { await controller.handler(req, res2); } catch { /* expected */ }

      // Assert
      expect(res2.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    }, 1000);

    it('should use fallback IP from socket when req.ip is undefined', async () => {
      // Arrange
      const handlerFn = jest.fn();
      const controller = new BardController(handlerFn);
      const req = makeReq({ ip: undefined });
      const res = makeRes();

      // Act
      await controller.handler(req, res);

      // Assert
      expect(handlerFn).toHaveBeenCalled();
    }, 1000);
  });

  describe('middlewares', () => {
    it('should run middlewares before the handler', async () => {
      // Arrange
      const callOrder: string[] = [];
      const middleware = (_req: Request, _res: Response, next: NextFunction) => {
        callOrder.push('middleware');
        next();
      };
      const handlerFn = () => { callOrder.push('handler'); };
      const controller = new BardController(handlerFn, { middlewares: [middleware] });

      // Act
      await controller.handler(makeReq(), makeRes());

      // Assert
      expect(callOrder).toEqual(['middleware', 'handler']);
    }, 1000);

    it('should run multiple middlewares in order', async () => {
      // Arrange
      const callOrder: string[] = [];
      const mw1 = (_req: Request, _res: Response, next: NextFunction) => {
        callOrder.push('mw1');
        next();
      };
      const mw2 = (_req: Request, _res: Response, next: NextFunction) => {
        callOrder.push('mw2');
        next();
      };
      const handlerFn = () => { callOrder.push('handler'); };
      const controller = new BardController(handlerFn, { middlewares: [mw1, mw2] });

      // Act
      await controller.handler(makeReq(), makeRes());

      // Assert
      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    }, 1000);

    it('should stop the chain when middleware sends a response without calling next', async () => {
      // Arrange
      const handlerFn = jest.fn();
      const blockingMiddleware = (_req: Request, res: Response) => {
        res.status(403).json({ error: 'Forbidden' });
      };
      const controller = new BardController(handlerFn, { middlewares: [blockingMiddleware] });

      // Act
      await controller.handler(makeReq(), makeRes());

      // Assert
      expect(handlerFn).not.toHaveBeenCalled();
    }, 1000);

    it('should propagate errors thrown by middleware', async () => {
      // Arrange
      const errorMiddleware = () => {
        throw new Error('Middleware error');
      };
      const controller = new BardController(jest.fn(), { middlewares: [errorMiddleware] });

      // Act & Assert
      await expect(controller.handler(makeReq(), makeRes())).rejects.toThrow('Middleware error');
    }, 1000);

    it('should propagate errors passed to next(err)', async () => {
      // Arrange
      const errorMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
        next(new Error('Next error'));
      };
      const controller = new BardController(jest.fn(), { middlewares: [errorMiddleware] });

      // Act & Assert
      await expect(controller.handler(makeReq(), makeRes())).rejects.toThrow('Next error');
    }, 1000);

    it('should handle async middlewares that call next', async () => {
      // Arrange
      const handlerFn = jest.fn();
      const asyncMiddleware = async (_req: Request, _res: Response, next: NextFunction) => {
        await Promise.resolve();
        next();
      };
      const controller = new BardController(handlerFn, { middlewares: [asyncMiddleware] });

      // Act
      await controller.handler(makeReq(), makeRes());

      // Assert
      expect(handlerFn).toHaveBeenCalled();
    }, 1000);

    it('should handle async middlewares that send response without next', async () => {
      // Arrange
      const handlerFn = jest.fn();
      const asyncBlockingMiddleware = async (_req: Request, res: Response) => {
        await Promise.resolve();
        res.status(400).json({ error: 'Bad' });
      };
      const controller = new BardController(handlerFn, { middlewares: [asyncBlockingMiddleware] });

      // Act
      await controller.handler(makeReq(), makeRes());

      // Assert
      expect(handlerFn).not.toHaveBeenCalled();
    }, 1000);
  });

  describe('throttleConfig', () => {
    it('should use STANDARD preset by default', async () => {
      // Arrange
      const controller = new BardController(jest.fn());
      const req = makeReq();
      const res = makeRes();

      // Act
      await controller.handler(req, res);

      // Assert
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '99');
    }, 1000);

    it('should accept a preset string', async () => {
      // Arrange
      const controller = new BardController(jest.fn(), { throttleConfig: 'SECURITY' });
      const req = makeReq();
      const res = makeRes();

      // Act
      await controller.handler(req, res);

      // Assert
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
    }, 1000);

    it('should accept a custom config object', async () => {
      // Arrange
      const controller = new BardController(jest.fn(), { throttleConfig: { limit: 50, ttl: 30_000 } });
      const req = makeReq();
      const res = makeRes();

      // Act
      await controller.handler(req, res);

      // Assert
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '49');
    }, 1000);
  });

  describe('metadata', () => {
    it('should return preset name and resolved config for preset throttle', () => {
      // Arrange
      const controller = new BardController(jest.fn(), { throttleConfig: 'SECURITY' });

      // Act
      const meta = controller.metadata;

      // Assert
      expect(meta.throttlePreset).toBe('SECURITY');
      expect(meta.throttleConfig).toEqual({ limit: 5, ttl: 60_000 });
    }, 1000);

    it('should return null preset for custom throttle config', () => {
      // Arrange
      const controller = new BardController(jest.fn(), { throttleConfig: { limit: 25, ttl: 120_000 } });

      // Act
      const meta = controller.metadata;

      // Assert
      expect(meta.throttlePreset).toBeNull();
      expect(meta.throttleConfig).toEqual({ limit: 25, ttl: 120_000 });
    }, 1000);

    it('should default to STANDARD preset', () => {
      // Arrange
      const controller = new BardController(jest.fn());

      // Act
      const meta = controller.metadata;

      // Assert
      expect(meta.throttlePreset).toBe('STANDARD');
      expect(meta.throttleConfig).toEqual({ limit: 100, ttl: 60_000 });
    }, 1000);
  });
});
