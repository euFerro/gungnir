import type { Request, Response, NextFunction } from 'express';
import { globalExceptionMiddleware } from './global-exception.middleware';
import { BadRequestException, HttpException } from '../exceptions/http.exception';

const makeRes = (): Response => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
} as unknown as Response);

describe('globalExceptionMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return structured JSON for HttpException', () => {
    // Arrange
    const err = new BadRequestException('Invalid email');
    const res = makeRes();

    // Act
    globalExceptionMiddleware(err, {} as Request, res, jest.fn() as unknown as NextFunction);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email' });
  }, 1000);

  it('should return 500 for generic errors', () => {
    // Arrange
    const err = new Error('Something broke');
    const res = makeRes();

    // Act
    globalExceptionMiddleware(err, {} as Request, res, jest.fn() as unknown as NextFunction);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  }, 1000);

  it('should preserve the status code from HttpException', () => {
    // Arrange
    const err = new HttpException(503, 'Service down');
    const res = makeRes();

    // Act
    globalExceptionMiddleware(err, {} as Request, res, jest.fn() as unknown as NextFunction);

    // Assert
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Service down' });
  }, 1000);
});
