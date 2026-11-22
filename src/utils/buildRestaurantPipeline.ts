import { IRestaurantFilters, MAX_RESTAURANTS_PAGE_SIZE } from '@interfaces/restaurantFilters.interface';
import { escapeRegex } from '@utils/escapeRegex';
import { PipelineStage } from 'mongoose';

const sortOrders: Record<string, Record<string, 1 | -1>> = {
  rating: { 'rating.aggregate': 1 },
  '-rating': { 'rating.aggregate': -1 },
  name: { name: 1 },
  '-name': { name: -1 },
  cost: { costForTwoInr: 1 },
  '-cost': { costForTwoInr: -1 },
};

const restaurantSummaryProjection = {
  name: 1,
  address: 1,
  city: 1,
  country: 1,
  cuisines: 1,
  'rating.aggregate': 1,
  distanceM: 1,
};

const containsText = (value: string) => ({ $regex: escapeRegex(value), $options: 'i' });

export const buildRestaurantMatch = (filters: IRestaurantFilters): Record<string, any> => {
  const match: Record<string, any> = {};
  if (filters.name) match.name = containsText(filters.name);
  if (filters.city) match.city = filters.city;
  if (filters.country) match.country = filters.country;
  if (filters.cuisines?.length) match.cuisines = { $in: filters.cuisines };
  if (filters.minRating !== undefined) match['rating.aggregate'] = { $gte: filters.minRating };
  if (filters.maxCostForTwo !== undefined) match.costForTwoInr = { $lte: filters.maxCostForTwo };
  if (filters.dish) {
    match.$or = [{ name: containsText(filters.dish) }, { cuisines: containsText(filters.dish) }];
    if (filters.dishCuisine) match.$or.push({ cuisines: filters.dishCuisine });
  }
  return match;
};

export const buildRestaurantPipeline = (filters: IRestaurantFilters, { extra = 0 } = {}): PipelineStage[] => {
  const hasLocation = filters.lat !== undefined && filters.lng !== undefined;
  const match = buildRestaurantMatch(filters);
  const limit = Math.min(filters.limit, MAX_RESTAURANTS_PAGE_SIZE);
  const pipeline: PipelineStage[] = [];

  if (hasLocation) {
    pipeline.push({
      $geoNear: {
        near: { type: 'Point', coordinates: [Number(filters.lng), Number(filters.lat)] },
        key: 'location',
        distanceField: 'distanceM',
        spherical: true,
        query: match,
        ...(filters.maxDistanceKm !== undefined && { maxDistance: filters.maxDistanceKm * 1000 }),
      },
    });
  } else {
    pipeline.push({ $match: match });
  }

  const sortKey = filters.sort === 'relevance' ? (hasLocation ? null : '-rating') : filters.sort;
  if (sortKey && sortKey !== 'distance') {
    pipeline.push({ $sort: { ...sortOrders[sortKey], _id: 1 } });
  }

  pipeline.push({ $skip: (filters.page - 1) * limit }, { $limit: limit + extra }, { $project: restaurantSummaryProjection });
  return pipeline;
};
