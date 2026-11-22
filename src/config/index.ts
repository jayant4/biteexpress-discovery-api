import { config } from 'dotenv';
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local`, quiet: true });

export const {
  NODE_ENV = 'development',
  PORT = '8000',
  MONGODB_CONNECTION_URL = 'mongodb://localhost:27018/biteexpress',
  LOG_FORMAT = 'dev',
  ORIGIN = '*',
  NL_PARSER = 'rules',
  DISTANCE_RANKER = 'straight-line',
  GEOCODER = 'locality',
  CSV_FILE_PATH = 'data/zomato.csv',
  SAMPLE_CSV_FILE_PATH = 'data/sample.csv',
} = process.env;

export const MONGO_QUERY_TIMEOUT_MS = Number(process.env.MONGO_QUERY_TIMEOUT_MS || 2000);
