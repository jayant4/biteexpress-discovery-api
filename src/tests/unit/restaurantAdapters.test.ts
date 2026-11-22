import { createDistanceRanker, IDistanceRanker, StraightLineDistanceRanker } from '@adapters/distanceRanker.adapter';
import { createGeocoder, IGeocoder, LocalityGeocoder } from '@adapters/geocoder.adapter';
import { TRestaurantSortKey } from '@interfaces/restaurantFilters.interface';
import RestaurantService from '@services/restaurant.service';

const createRestaurantService = (restaurants: any[] = []) => {
  const restaurantService = new RestaurantService();
  const findRestaurants = jest.spyOn(restaurantService, 'findRestaurants').mockResolvedValue(restaurants);
  return { restaurantService, findRestaurants };
};

afterEach(() => jest.restoreAllMocks());

describe('adapter factories', () => {
  test('build the default adapters from their config names', () => {
    expect(createDistanceRanker('straight-line')).toBeInstanceOf(StraightLineDistanceRanker);
    expect(createGeocoder('locality', async () => null)).toBeInstanceOf(LocalityGeocoder);
  });

  test('fail fast on an unknown provider, listing the supported ones', () => {
    expect(() => createDistanceRanker('teleport')).toThrow(/Supported: straight-line/);
    expect(() => createGeocoder('google', async () => null)).toThrow(/Supported: locality/);
  });
});

describe('distance ranker adapter', () => {
  const nearLocation: { lat: number; lng: number; sort: TRestaurantSortKey } = { lat: 28.46, lng: 77.03, sort: 'distance' };
  const nearestRestaurants = [1, 2, 3, 4, 5].map(n => ({ n }));

  const createReversingRanker = (): IDistanceRanker => ({
    name: 'fake-eta',
    reorders: true,
    rank: jest.fn(async (_origin, restaurants) => [...restaurants].reverse()),
  });

  test('straight-line keeps the normal database paging', async () => {
    const { restaurantService, findRestaurants } = createRestaurantService(nearestRestaurants);
    await restaurantService.listRestaurants({ ...nearLocation, page: 1, limit: 2 });
    expect(findRestaurants).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 2 }), 1);
  });

  test('a reordering ranker ranks one window, then pages inside it', async () => {
    const { restaurantService, findRestaurants } = createRestaurantService(nearestRestaurants);
    restaurantService.distanceRanker = createReversingRanker();

    const firstPage = await restaurantService.listRestaurants({ ...nearLocation, page: 1, limit: 2 });
    expect(findRestaurants).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 50 }));
    expect(restaurantService.distanceRanker.rank).toHaveBeenCalledWith({ lat: 28.46, lng: 77.03 }, nearestRestaurants);
    expect(firstPage.restaurants).toEqual([{ n: 5 }, { n: 4 }]);
    expect(firstPage.hasMore).toBe(true);

    const thirdPage = await restaurantService.listRestaurants({ ...nearLocation, page: 3, limit: 2 });
    expect(thirdPage.restaurants).toEqual([{ n: 1 }]);
    expect(thirdPage.hasMore).toBe(false);
  });

  test('is not used when results are not nearest-first', async () => {
    const { restaurantService, findRestaurants } = createRestaurantService(nearestRestaurants);
    restaurantService.distanceRanker = createReversingRanker();
    await restaurantService.listRestaurants({ ...nearLocation, sort: '-rating', page: 1, limit: 2 });
    expect(findRestaurants).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }), 1);
  });
});

describe('geocoder adapter', () => {
  const connaughtPlace = { lat: 28.63, lng: 77.22 };

  const createFakeGeocoder = (coordinates: { lat: number; lng: number } | null): IGeocoder => ({
    name: 'fake-maps',
    geocode: jest.fn(async () => coordinates),
  });

  test('the locality geocoder trims the place before looking it up', async () => {
    const findLocalityCentre = jest.fn(async () => connaughtPlace);
    const geocoder = new LocalityGeocoder(findLocalityCentre);
    await expect(geocoder.geocode('  connaught place ')).resolves.toEqual(connaughtPlace);
    expect(findLocalityCentre).toHaveBeenCalledWith('connaught place');
  });

  test('the list endpoint geocodes a place too', async () => {
    const { restaurantService, findRestaurants } = createRestaurantService();
    restaurantService.geocoder = createFakeGeocoder(connaughtPlace);
    await restaurantService.listRestaurants({ place: 'connaught place', sort: 'distance', page: 1, limit: 20 });
    expect(findRestaurants).toHaveBeenCalledWith(expect.objectContaining(connaughtPlace), 1);
  });

  test('explicit coordinates win, so the geocoder is not called', async () => {
    const { restaurantService, findRestaurants } = createRestaurantService();
    restaurantService.geocoder = createFakeGeocoder(connaughtPlace);
    await restaurantService.listRestaurants({ sort: 'relevance', place: 'connaught place', lat: 19.07, lng: 72.87, page: 1, limit: 20 });
    expect(restaurantService.geocoder.geocode).not.toHaveBeenCalled();
    expect(findRestaurants).toHaveBeenCalledWith(expect.objectContaining({ lat: 19.07, lng: 72.87 }), 1);
  });

  test('a geocoded place gets the default radius unless one was given', async () => {
    const { restaurantService, findRestaurants } = createRestaurantService();
    restaurantService.geocoder = createFakeGeocoder(connaughtPlace);
    await restaurantService.listRestaurants({ sort: 'relevance', place: 'connaught place', page: 1, limit: 20 });
    expect(findRestaurants).toHaveBeenLastCalledWith(expect.objectContaining({ maxDistanceKm: 5 }), 1);
    await restaurantService.listRestaurants({ sort: 'relevance', place: 'connaught place', maxDistanceKm: 12, page: 1, limit: 20 });
    expect(findRestaurants).toHaveBeenLastCalledWith(expect.objectContaining({ maxDistanceKm: 12 }), 1);
  });

  test('explicit coordinates without a radius are left unbounded', async () => {
    const { restaurantService, findRestaurants } = createRestaurantService();
    await restaurantService.listRestaurants({ sort: 'relevance', lat: 28.63, lng: 77.22, page: 1, limit: 20 });
    expect(findRestaurants.mock.calls[0][0].maxDistanceKm).toBeUndefined();
  });

  test('an unknown place is a 404 that names the place', async () => {
    const { restaurantService } = createRestaurantService();
    restaurantService.geocoder = createFakeGeocoder(null);
    await expect(restaurantService.listRestaurants({ sort: 'relevance', place: 'atlantis', page: 1, limit: 20 })).rejects.toMatchObject({
      status: 404,
      message: 'Could not find a place called "atlantis"',
    });
  });
});
