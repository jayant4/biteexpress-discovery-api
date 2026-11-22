import { ERestaurantSource, IRestaurant, IRestaurantFlags, IRestaurantLocation, IRestaurantRating } from '@interfaces/restaurant.interface';
import { model, Schema } from 'mongoose';

const locationSchema = new Schema<IRestaurantLocation>(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true, default: undefined },
  },
  { _id: false },
);

const flagsSchema = new Schema<IRestaurantFlags>(
  {
    hasTableBooking: { type: Boolean, default: false },
    hasOnlineDelivery: { type: Boolean, default: false },
    isDeliveringNow: { type: Boolean, default: false },
  },
  { _id: false },
);
const ratingSchema = new Schema<IRestaurantRating>(
  {
    aggregate: { type: Number, default: null },
    text: { type: String },
    color: { type: String },
    votes: { type: Number, default: 0 },
  },
  { _id: false },
);

const restaurantSchema = new Schema<IRestaurant>(
  {
    externalId: { type: Number },
    source: { type: String, enum: Object.values(ERestaurantSource), required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    locality: { type: String },
    localityVerbose: { type: String },
    city: { type: String, required: true },
    country: { type: String, required: true },
    countryCode: { type: Number },
    location: { type: locationSchema, default: undefined },
    cuisines: { type: [String], default: [] },
    costForTwo: { type: Number },
    costForTwoInr: { type: Number },
    currency: { type: String },
    priceRange: { type: Number },
    flags: { type: flagsSchema, default: () => ({}) },
    rating: { type: ratingSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    versionKey: false,
    autoIndex: false,
    autoCreate: false,
    collation: { locale: 'en', strength: 2 },
  },
);

restaurantSchema.index({ location: '2dsphere' }, { name: 'location_2dsphere' });
restaurantSchema.index({ city: 1, 'rating.aggregate': -1, _id: 1 }, { name: 'city_rating_id' });
restaurantSchema.index({ country: 1, 'rating.aggregate': -1, _id: 1 }, { name: 'country_rating_id' });
restaurantSchema.index({ cuisines: 1, 'rating.aggregate': -1, _id: 1 }, { name: 'cuisines_rating_id' });
restaurantSchema.index({ locality: 1 }, { name: 'locality' });
restaurantSchema.index({ externalId: 1 }, { name: 'externalId_unique', unique: true, partialFilterExpression: { externalId: { $exists: true } } });

const restaurantModel = model<IRestaurant>('Restaurant', restaurantSchema, 'restaurants');

export default restaurantModel;
