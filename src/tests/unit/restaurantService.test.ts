import { HttpException } from '@exceptions/HttpException';
import { toInr } from '@utils/currency';
import { IRestaurantFilters } from '@interfaces/restaurantFilters.interface';
import restaurantModel from '@models/restaurant.model';
import RestaurantService from '@services/restaurant.service';

const defaultFilters: IRestaurantFilters = { sort: 'relevance', page: 1, limit: 2 };

const createRestaurantService = (restaurants: any[] = []) => {
  const restaurantService = new RestaurantService();
  const findRestaurants = jest.spyOn(restaurantService, 'findRestaurants').mockResolvedValue(restaurants);
  return { restaurantService, findRestaurants };
};

afterEach(() => jest.restoreAllMocks());

describe('RestaurantService.listRestaurants', () => {
  test('rejects sort=distance without coordinates', async () => {
    const { restaurantService } = createRestaurantService();
    await expect(restaurantService.listRestaurants({ ...defaultFilters, sort: 'distance' })).rejects.toThrow(HttpException);
    await expect(restaurantService.listRestaurants({ ...defaultFilters, sort: 'distance' })).rejects.toThrow(/lat/);
  });

  test('rejects lat without lng, and lng without lat', async () => {
    const { restaurantService } = createRestaurantService();
    await expect(restaurantService.listRestaurants({ ...defaultFilters, lat: 28.4 })).rejects.toThrow(/lat and lng/);
    await expect(restaurantService.listRestaurants({ ...defaultFilters, lng: 77.1 })).rejects.toThrow(/lat and lng/);
  });

  test('asks for one extra row and turns it into hasMore', async () => {
    const { restaurantService, findRestaurants } = createRestaurantService([{ n: 1 }, { n: 2 }, { n: 3 }]);
    const restaurantPage = await restaurantService.listRestaurants(defaultFilters);
    expect(findRestaurants).toHaveBeenCalledWith(defaultFilters, 1);
    expect(restaurantPage.restaurants).toHaveLength(2);
    expect(restaurantPage.hasMore).toBe(true);
  });

  test('hasMore is false when no extra row comes back', async () => {
    const { restaurantService } = createRestaurantService([{ n: 1 }]);
    expect((await restaurantService.listRestaurants(defaultFilters)).hasMore).toBe(false);
  });

  test('reports the capped limit', async () => {
    const { restaurantService } = createRestaurantService();
    expect((await restaurantService.listRestaurants({ ...defaultFilters, limit: 999 })).limit).toBe(50);
  });
});

describe('RestaurantService.createRestaurant and getRestaurantById', () => {
  test('stores lat/lng as a GeoJSON point [lng, lat] and marks the source', async () => {
    const createRestaurant = jest.spyOn(restaurantModel, 'create').mockResolvedValue({ toObject: () => ({}) } as any);
    const { restaurantService } = createRestaurantService();
    await restaurantService.createRestaurant({
      name: 'X',
      address: 'A',
      city: 'Gurgaon',
      country: 'India',
      cuisines: [],
      lat: 28.4,
      lng: 77.1,
      avgRating: 4,
      costForTwo: 20,
      currency: 'USD',
    });
    const savedRestaurant = createRestaurant.mock.calls[0][0] as Record<string, any>;
    expect(savedRestaurant.location).toEqual({ type: 'Point', coordinates: [77.1, 28.4] });
    expect(savedRestaurant.source).toBe('api');
    expect(savedRestaurant.rating).toEqual({ aggregate: 4, votes: 0 });
    expect(savedRestaurant).not.toHaveProperty('lat');
    expect(savedRestaurant.costForTwoInr).toBe(toInr(20, 'USD'));
  });

  test('getRestaurantById throws a 404 when nothing is found', async () => {
    const { restaurantService } = createRestaurantService();
    await expect(restaurantService.getRestaurantById('x')).rejects.toMatchObject({ status: 404 });
  });
});
