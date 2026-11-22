import { cleanEnv, num, port, str, url } from 'envalid';

const validateEnv = () => {
  cleanEnv(process.env, {
    NODE_ENV: str({ default: 'development' }),
    PORT: port({ default: 8000 }),
    MONGODB_CONNECTION_URL: url({ default: 'mongodb://localhost:27018/biteexpress' }),
    MONGO_QUERY_TIMEOUT_MS: num({ default: 2000 }),
  });
};

export default validateEnv;
