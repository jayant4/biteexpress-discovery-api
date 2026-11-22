import { LOG_FORMAT, NODE_ENV, ORIGIN, PORT } from '@config';
import { Routes } from '@interfaces/routes.interface';
import errorMiddleware from '@middlewares/error.middleware';
import { logger, stream } from '@utils/logger';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { Server } from 'http';
import morgan from 'morgan';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

class App {
  public app: express.Application;
  public env: string;
  public port: string | number;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV;
    this.port = PORT;

    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeSwagger();
    this.initializeErrorHandling();
  }

  public listen(): Server {
    return this.app.listen(this.port, () => {
      logger.info(`App listening on the port ${this.port} | ENV: ${this.env}`);
    });
  }

  public getServer() {
    return this.app;
  }

  private initializeMiddlewares() {
    if (this.env !== 'test') {
      this.app.use(morgan(LOG_FORMAT, { stream }));
    }
    this.app.use(cors({ origin: ORIGIN, methods: ['GET', 'POST', 'OPTIONS'] }));
    this.app.use(hpp());
    this.app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
    this.app.use(compression());
    this.app.use(express.json({ limit: '100kb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private initializeRoutes(routes: Routes[]) {
    routes.forEach(route => {
      this.app.use('/', route.router);
    });
  }

  private initializeSwagger() {
    const specs = swaggerJSDoc({
      definition: {
        openapi: '3.0.3',
        info: { title: 'BiteExpress Restaurant Discovery API', version: '1.0.0' },
      },
      apis: ['swagger.yaml'],
    });
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private initializeErrorHandling() {
    this.app.use((req, res) => {
      res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
    });
    this.app.use(errorMiddleware);
  }
}

export default App;
