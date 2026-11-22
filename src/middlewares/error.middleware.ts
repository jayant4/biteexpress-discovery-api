import { HttpException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';
import { NextFunction, Request, Response } from 'express';

const errorMiddleware = (error: HttpException, request: Request, response: Response, next: NextFunction) => {
  if (response.headersSent) {
    return next(error);
  }

  const status: number = error.status || 500;
  const message: string = status < 500 || error instanceof HttpException ? error.message : 'Something went wrong';
  if (status >= 500) {
    logger.error(`[${request.method}] ${request.path} >> StatusCode:: ${status}, Message:: ${error.message}\n stack: ${error.stack}`);
  } else {
    logger.warn(`[${request.method}] ${request.path} >> StatusCode:: ${status}, Message:: ${error.message}`);
  }
  response.status(status).json({ message });
};

export default errorMiddleware;
