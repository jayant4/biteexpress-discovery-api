import App from '@/app';
import { connectToDatabase, disconnectFromDatabase } from '@databases';
import IndexRoute from '@routes/index.route';
import RestaurantRoute from '@routes/restaurant.route';
import RestaurantService from '@services/restaurant.service';
import { logger } from '@utils/logger';
import validateEnv from '@utils/validateEnv';

validateEnv();

const startServer = async () => {
  await connectToDatabase();
  logger.info('Connected to database');
  await new RestaurantService().ensureRestaurantIndexes();

  const app = new App([new IndexRoute(), new RestaurantRoute()]);
  const server = app.listen();

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectFromDatabase();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch(error => {
  logger.error(`Failed to start server: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
});
