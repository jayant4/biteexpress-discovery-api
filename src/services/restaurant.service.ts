import { createDistanceRanker, IDistanceRanker } from '@adapters/distanceRanker.adapter';
import { createGeocoder, IGeocoder } from '@adapters/geocoder.adapter';
import { createQueryParser, IQueryParser } from '@adapters/queryParser.adapter';
import { DISTANCE_RANKER, GEOCODER, MONGO_QUERY_TIMEOUT_MS, NL_PARSER } from '@config';
import { CreateRestaurantDto, ParsedRestaurantFiltersDto } from '@dtos/restaurant.dto';
import { HttpException } from '@exceptions/HttpException';
import { ERestaurantSource, ICitiesAndCuisines, ILatLng, INewRestaurant, IRestaurant } from '@interfaces/restaurant.interface';
import {
  DEFAULT_PLACE_RADIUS_KM,
  IPaginatedRestaurants,
  IParsedRestaurantFilters,
  IRestaurantFilters,
  IRestaurantSummary,
  ISearchedRestaurants,
  ISearchRestaurantFilters,
  MAX_RESTAURANTS_PAGE_SIZE,
} from '@interfaces/restaurantFilters.interface';
import restaurantModel from '@models/restaurant.model';
import { buildRestaurantPipeline } from '@utils/buildRestaurantPipeline';
import { toInr } from '@utils/currency';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const objectIdPattern = /^[0-9a-f]{24}$/i;

const removeUndefinedValues = (filters: IParsedRestaurantFilters): IParsedRestaurantFilters => {
  const definedFilters: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) definedFilters[key] = value;
  }
  return definedFilters;
};

const isNearestFirst = (filters: IRestaurantFilters) => filters.lat !== undefined && (filters.sort === 'distance' || filters.sort === 'relevance');

class RestaurantService {
  public restaurants = restaurantModel;
  public queryParser: IQueryParser = createQueryParser(NL_PARSER, () => this.getCitiesAndCuisines());
  public distanceRanker: IDistanceRanker = createDistanceRanker(DISTANCE_RANKER);
  public geocoder: IGeocoder = createGeocoder(GEOCODER, locality => this.findLocalityCentre(locality));

  public async ensureRestaurantIndexes(): Promise<void> {
    await this.restaurants.createCollection();
    await this.restaurants.createIndexes();
  }

  public async createRestaurant(restaurantData: CreateRestaurantDto): Promise<IRestaurant> {
    const { lat, lng, avgRating, ...restaurantDetails } = restaurantData;
    if ((lat === undefined) !== (lng === undefined)) {
      throw new HttpException(400, 'lat and lng must be given together');
    }

    const createdRestaurant = await this.restaurants.create({
      ...restaurantDetails,
      costForTwoInr: toInr(restaurantDetails.costForTwo, restaurantDetails.currency),
      source: ERestaurantSource.Api,
      ...(lat !== undefined && lng !== undefined && { location: { type: 'Point', coordinates: [lng, lat] } }),
      flags: { hasTableBooking: false, hasOnlineDelivery: false, isDeliveringNow: false },
      rating: { aggregate: avgRating ?? null, votes: 0 },
    });
    return createdRestaurant.toObject();
  }

  public async getRestaurantById(restaurantId: string): Promise<IRestaurant> {
    const restaurantDetails = objectIdPattern.test(restaurantId) ? await this.restaurants.findById(restaurantId).lean<IRestaurant>() : null;
    if (!restaurantDetails) {
      throw new HttpException(404, 'Restaurant not found');
    }
    return restaurantDetails;
  }

  public async listRestaurants(requestedFilters: IRestaurantFilters): Promise<IPaginatedRestaurants> {
    const filters = await this.resolvePlace(requestedFilters);
    this.validateFilters(filters);
    const limit = Math.min(filters.limit, MAX_RESTAURANTS_PAGE_SIZE);
    if (this.distanceRanker.reorders && isNearestFirst(filters)) {
      return this.listRestaurantsRankedByDistance(filters, limit);
    }

    const restaurants = await this.findRestaurants(filters, 1);
    return {
      restaurants: restaurants.slice(0, limit),
      page: filters.page,
      limit,
      hasMore: restaurants.length > limit,
    };
  }

  public async searchRestaurants(searchFilters: ISearchRestaurantFilters): Promise<ISearchedRestaurants> {
    const { q, page, limit, ...explicitFilters } = searchFilters;
    const parsedFilters = q ? await this.parseSearchText(q) : {};
    const mergedFilters = { ...parsedFilters, ...removeUndefinedValues(explicitFilters) };
    const filters = await this.resolvePlace({ ...mergedFilters, sort: mergedFilters.sort ?? 'relevance', page, limit });

    const restaurantPage = await this.listRestaurants(filters);
    const { page: _page, limit: _limit, ...interpreted } = filters;
    return { ...restaurantPage, interpreted };
  }

  public async findRestaurants(filters: IRestaurantFilters, extra = 0): Promise<IRestaurantSummary[]> {
    return this.restaurants.aggregate(buildRestaurantPipeline(filters, { extra })).option({ maxTimeMS: MONGO_QUERY_TIMEOUT_MS });
  }

  public async getCitiesAndCuisines(): Promise<ICitiesAndCuisines> {
    const [cities, cuisines] = await Promise.all([this.restaurants.distinct('city'), this.restaurants.distinct('cuisines')]);
    return { cities: cities as string[], cuisines: cuisines as string[] };
  }

  public async findLocalityCentre(locality: string): Promise<ILatLng | null> {
    const [centre] = await this.restaurants
      .aggregate([
        { $match: { locality, location: { $exists: true } } },
        {
          $group: {
            _id: null,
            lng: { $avg: { $arrayElemAt: ['$location.coordinates', 0] } },
            lat: { $avg: { $arrayElemAt: ['$location.coordinates', 1] } },
          },
        },
      ])
      .option({ maxTimeMS: MONGO_QUERY_TIMEOUT_MS });
    return centre ? { lat: centre.lat, lng: centre.lng } : null;
  }

  public async upsertRestaurantsByExternalId(restaurantList: INewRestaurant[]): Promise<number> {
    if (!restaurantList.length) return 0;
    const result = await this.restaurants.bulkWrite(
      restaurantList.map(restaurant => ({
        updateOne: {
          filter: { externalId: restaurant.externalId },
          update: { $set: restaurant },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return result.upsertedCount + result.matchedCount;
  }

  public async countRestaurants(): Promise<number> {
    return this.restaurants.countDocuments();
  }

  private validateFilters(filters: IRestaurantFilters): void {
    if ((filters.lat === undefined) !== (filters.lng === undefined)) {
      throw new HttpException(400, 'lat and lng must be given together');
    }
    if (filters.sort === 'distance' && filters.lat === undefined) {
      throw new HttpException(400, 'sort=distance needs both lat and lng');
    }
  }

  private async resolvePlace(filters: IRestaurantFilters): Promise<IRestaurantFilters> {
    if (!filters.place || filters.lat !== undefined || filters.lng !== undefined) return filters;
    const coordinates = await this.geocoder.geocode(filters.place);
    if (!coordinates) {
      throw new HttpException(404, `Could not find a place called "${filters.place}"`);
    }
    return { ...filters, lat: coordinates.lat, lng: coordinates.lng, maxDistanceKm: filters.maxDistanceKm ?? DEFAULT_PLACE_RADIUS_KM };
  }

  private async parseSearchText(query: string): Promise<IParsedRestaurantFilters> {
    const parsedFilters = plainToInstance(ParsedRestaurantFiltersDto, await this.queryParser.parse(query));
    const errors = await validate(parsedFilters, { whitelist: true });
    const hasHalfLocation = (parsedFilters.lat === undefined) !== (parsedFilters.lng === undefined);
    if (errors.length || hasHalfLocation) {
      throw new HttpException(502, `Query parser "${this.queryParser.name}" returned invalid filters`);
    }
    return removeUndefinedValues(parsedFilters);
  }

  private async listRestaurantsRankedByDistance(filters: IRestaurantFilters, limit: number): Promise<IPaginatedRestaurants> {
    const nearestRestaurants = await this.findRestaurants({ ...filters, page: 1, limit: MAX_RESTAURANTS_PAGE_SIZE });
    const rankedRestaurants = await this.distanceRanker.rank({ lat: Number(filters.lat), lng: Number(filters.lng) }, nearestRestaurants);
    const start = (filters.page - 1) * limit;
    return {
      restaurants: rankedRestaurants.slice(start, start + limit),
      page: filters.page,
      limit,
      hasMore: rankedRestaurants.length > start + limit,
    };
  }
}

export default RestaurantService;
