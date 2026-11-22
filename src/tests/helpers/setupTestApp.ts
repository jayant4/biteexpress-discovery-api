import App from '@/app';
import { connectToDatabase, disconnectFromDatabase } from '@databases';
import { ERestaurantSource, IRestaurantLocation, IRestaurantRating } from '@interfaces/restaurant.interface';
import restaurantModel from '@models/restaurant.model';
import IndexRoute from '@routes/index.route';
import RestaurantRoute from '@routes/restaurant.route';
import RestaurantService from '@services/restaurant.service';
import { Application } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import os from 'os';

export const GURGAON = { lat: 28.4595, lng: 77.0266 };

const point = (lat: number, lng: number): IRestaurantLocation => ({ type: 'Point', coordinates: [lng, lat] });

interface IRestaurantFixture {
  name: string;
  address: string;
  locality?: string;
  city: string;
  country: string;
  cuisines: string[];
  costForTwo: number;
  currency?: string;
  costForTwoInr?: number;
  location?: IRestaurantLocation;
  rating: IRestaurantRating;
}

export interface ITestApp {
  app: Application;
  stopTestApp: () => Promise<void>;
}

export const restaurantFixtures: IRestaurantFixture[] = [
  {
    name: 'Dakshin Delight',
    address: 'Sector 29',
    locality: 'Sector 29',
    city: 'Gurgaon',
    country: 'India',
    cuisines: ['South Indian'],
    costForTwo: 800,
    location: point(28.46, 77.027),
    rating: { aggregate: 4.5, votes: 120 },
  },
  {
    name: 'Udupi Express',
    address: 'MG Road',
    city: 'Gurgaon',
    country: 'India',
    cuisines: ['South Indian'],
    costForTwo: 400,
    location: point(28.47, 77.04),
    rating: { aggregate: 3.9, votes: 40 },
  },
  {
    name: 'Dragon Wok',
    address: 'Cyber Hub',
    city: 'Gurgaon',
    country: 'India',
    cuisines: ['Chinese'],
    costForTwo: 500,
    location: point(28.48, 77.08),
    rating: { aggregate: 4.1, votes: 300 },
  },
  {
    name: 'Punjab Grill',
    address: 'Connaught Place',
    locality: 'Connaught Place',
    city: 'New Delhi',
    country: 'India',
    cuisines: ['North Indian'],
    costForTwo: 2000,
    location: point(28.6139, 77.209),
    rating: { aggregate: 4.9, votes: 900 },
  },
  {
    name: 'Ghost Cafe',
    address: 'Unknown',
    city: 'Noida',
    country: 'India',
    cuisines: ['Cafe'],
    costForTwo: 300,
    rating: { aggregate: 3.0, votes: 5 },
  },
  {
    name: 'Vada Pav Corner',
    address: 'Dadar',
    city: 'Mumbai',
    country: 'India',
    cuisines: ['Street Food'],
    costForTwo: 100,
    location: point(19.076, 72.8777),
    rating: { aggregate: 4.2, votes: 2000 },
  },
  {
    name: 'Liberty Diner',
    address: 'Broadway',
    city: 'New York',
    country: 'United States',
    cuisines: ['American'],
    costForTwo: 50,
    currency: 'USD',
    costForTwoInr: 4250,
    location: point(40.7128, -74.006),
    rating: { aggregate: 4.0, votes: 60 },
  },
];

export const setupTestApp = async (): Promise<ITestApp> => {
  const mongoServer = await MongoMemoryServer.create({ binary: { version: '8.2.6' } });
  await connectToDatabase(mongoServer.getUri('test'), { runtimeAdapters: { os } } as any);
  await new RestaurantService().ensureRestaurantIndexes();
  await restaurantModel.insertMany(
    restaurantFixtures.map(restaurant => ({
      currency: 'INR',
      costForTwoInr: restaurant.costForTwo,
      ...restaurant,
      source: ERestaurantSource.Zomato,
      flags: { hasTableBooking: false, hasOnlineDelivery: true, isDeliveringNow: false },
    })),
  );

  const app = new App([new IndexRoute(), new RestaurantRoute()]).getServer();

  const stopTestApp = async () => {
    await disconnectFromDatabase();
    await mongoServer.stop();
  };

  return { app, stopTestApp };
};
