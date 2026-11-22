import { MONGODB_CONNECTION_URL } from '@config';
import { connect, ConnectOptions, disconnect } from 'mongoose';

export const dbConnection = {
  url: MONGODB_CONNECTION_URL,
  options: {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  },
};

export const connectToDatabase = (url: string = dbConnection.url, options: ConnectOptions = {}) =>
  connect(url, { ...dbConnection.options, ...options });

export const disconnectFromDatabase = () => disconnect();
