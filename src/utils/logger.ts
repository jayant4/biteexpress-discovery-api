import { NODE_ENV } from '@config';
import winston from 'winston';

const logFormat = winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`);

const logger = winston.createLogger({
  level: NODE_ENV === 'test' ? 'error' : 'info',
  format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [new winston.transports.Console()],
});

const stream = {
  write: (message: string) => {
    logger.info(message.substring(0, message.lastIndexOf('\n')));
  },
};

export { logger, stream };
