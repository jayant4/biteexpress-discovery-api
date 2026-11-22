import { Types } from 'mongoose';

export enum ERestaurantSource {
  Zomato = 'zomato',
  Api = 'api',
}

export interface IRestaurantLocation {
  type: 'Point';
  coordinates: [number, number];
}

export interface IRestaurantFlags {
  hasTableBooking: boolean;
  hasOnlineDelivery: boolean;
  isDeliveringNow: boolean;
}

export interface IRestaurantRating {
  aggregate: number | null;
  text?: string;
  color?: string;
  votes: number;
}

export interface INewRestaurant {
  externalId?: number;
  source: ERestaurantSource;
  name: string;
  address: string;
  locality?: string;
  localityVerbose?: string;
  city: string;
  country: string;
  countryCode?: number;
  location?: IRestaurantLocation;
  cuisines: string[];
  costForTwo?: number;
  costForTwoInr?: number;
  currency?: string;
  priceRange?: number;
  flags: IRestaurantFlags;
  rating: IRestaurantRating;
}

export interface IRestaurant extends INewRestaurant {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILatLng {
  lat: number;
  lng: number;
}
