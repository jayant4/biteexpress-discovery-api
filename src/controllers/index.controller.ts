import { logger } from '@utils/logger';
import { Request, Response } from 'express';
import { connection } from 'mongoose';

class IndexController {
  public index = async (req: Request, res: Response) => {
    try {
      if (!connection.db) throw new Error('Database is not connected');
      await connection.db.admin().ping();
      res.status(200).json({ message: 'OK' });
    } catch (error) {
      logger.error(`Health check failed: ${(error as Error).message}`);
      res.status(503).json({ message: 'Database unreachable' });
    }
  };
}

export default IndexController;
