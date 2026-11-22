import { IRestaurant } from '@interfaces/restaurant.interface';
import { IPaginatedRestaurants, IRestaurantSummary } from '@interfaces/restaurantFilters.interface';

export const formatRestaurantSummary = (restaurant: IRestaurantSummary) => ({
  id: String(restaurant._id),
  name: restaurant.name,
  address: restaurant.address,
  city: restaurant.city,
  country: restaurant.country,
  cuisines: restaurant.cuisines ?? [],
  avgRating: restaurant.rating?.aggregate ?? null,
  ...(restaurant.distanceM !== undefined && { distanceKm: Math.round(restaurant.distanceM / 10) / 100 }),
});

export const formatRestaurantDetails = (restaurant: IRestaurant) => ({
  id: String(restaurant._id),
  externalId: restaurant.externalId,
  source: restaurant.source,
  name: restaurant.name,
  address: restaurant.address,
  locality: restaurant.locality,
  localityVerbose: restaurant.localityVerbose,
  city: restaurant.city,
  country: restaurant.country,
  countryCode: restaurant.countryCode,
  cuisines: restaurant.cuisines ?? [],
  avgRating: restaurant.rating?.aggregate ?? null,
  ...(restaurant.location && { lng: restaurant.location.coordinates[0], lat: restaurant.location.coordinates[1] }),
  costForTwo: restaurant.costForTwo,
  costForTwoInr: restaurant.costForTwoInr,
  currency: restaurant.currency,
  priceRange: restaurant.priceRange,
  flags: {
    hasTableBooking: restaurant.flags.hasTableBooking,
    hasOnlineDelivery: restaurant.flags.hasOnlineDelivery,
    isDeliveringNow: restaurant.flags.isDeliveringNow,
  },
  rating: {
    aggregate: restaurant.rating.aggregate ?? null,
    text: restaurant.rating.text,
    color: restaurant.rating.color,
    votes: restaurant.rating.votes,
  },
  createdAt: restaurant.createdAt,
  updatedAt: restaurant.updatedAt,
});

export const formatRestaurantPage = ({ restaurants, page, limit, hasMore }: IPaginatedRestaurants) => ({
  items: restaurants.map(formatRestaurantSummary),
  page,
  limit,
  hasMore,
});
