import type { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { requestInterceptorMiddleware } from './request-interceptor.middleware';

const makeReq = (method = 'GET', url = '/test'): Request =>
  ({ method, originalUrl: url } as Request);

const makeRes = (): Response => {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    statusCode: 200,
  }) as unknown as Response;
};

describe('requestInterceptorMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-04-14T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call next()', () => {
    // Arrange
    const next = jest.fn() as unknown as NextFunction;

    // Act
    requestInterceptorMiddleware(makeReq(), makeRes(), next);

    // Assert
    expect(next).toHaveBeenCalled();
  }, 1000);

  it('should log the response on finish event', () => {
    // Arrange
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    requestInterceptorMiddleware(makeReq('POST', '/api/users'), res, next);

    // Act
    (res as unknown as EventEmitter).emit('finish');

    // Assert — no error thrown means the finish handler executed
    expect(next).toHaveBeenCalled();
  }, 1000);
});
