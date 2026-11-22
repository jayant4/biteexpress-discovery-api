export const MAX_RESTAURANTS_PAGE_SIZE = 50;

export const DEFAULT_PLACE_RADIUS_KM = 5;

export type TRestaurantSortKey = 'relevance' | 'distance' | 'rating' | '-rating' | 'name' | '-name' | 'cost' | '-cost';

export const supportedRestaurantSortKeys: TRestaurantSortKey[] = ['relevance', 'distance', 'rating', '-rating', 'name', '-name', 'cost', '-cost'];

export interface IParsedRestaurantFilters {
  name?: string;
  city?: string;
  country?: string;
  cuisines?: string[];
  dish?: string;
  dishCuisine?: string;
  place?: string;
  minRating?: number;
  maxCostForTwo?: number;
  lat?: number;
  lng?: number;
  maxDistanceKm?: number;
  sort?: TRestaurantSortKey;
}

export interface IRestaurantFilters extends IParsedRestaurantFilters {
  sort: TRestaurantSortKey;
  page: number;
  limit: number;
}

export interface IRestaurantSummary {
  _id: unknown;
  name: string;
  address: string;
  city: string;
  country: string;
  cuisines?: string[];
  rating?: { aggregate: number | null };
  distanceM?: number;
}

export interface IPaginatedRestaurants {
  restaurants: IRestaurantSummary[];
  page: number;
  limit: number;
  hasMore: boolean;
}
