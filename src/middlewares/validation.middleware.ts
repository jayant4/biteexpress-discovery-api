import { HttpException } from '@exceptions/HttpException';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { RequestHandler } from 'express';

const getErrorMessages = (errors: ValidationError[]): string[] =>
  errors.flatMap(error => [...Object.values(error.constraints ?? {}), ...getErrorMessages(error.children ?? [])]);

const validationMiddleware = (
  type: any,
  value: 'body' | 'query' | 'params' = 'body',
  skipMissingProperties = false,
  whitelist = true,
  forbidNonWhitelisted = true,
): RequestHandler => {
  return (req, res, next) => {
    const dto = plainToInstance(type, req[value] ?? {});
    validate(dto, { skipMissingProperties, whitelist, forbidNonWhitelisted })
      .then(errors => {
        if (errors.length > 0) {
          return next(new HttpException(400, getErrorMessages(errors).join(', ')));
        }
        req[value] = dto;
        next();
      })
      .catch(next);
  };
};

export default validationMiddleware;
