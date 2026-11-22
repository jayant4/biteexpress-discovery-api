import { GURGAON, ITestApp, setupTestApp } from '../helpers/setupTestApp';
import request from 'supertest';

let testApp: ITestApp;

beforeAll(async () => {
  testApp = await setupTestApp();
}, 120000);

afterAll(() => testApp.stopTestApp());

const searchRestaurants = (queryString: string) => request(testApp.app).get(`/v1/restaurants/search?${queryString}`);
const searchText = (text: string) => `q=${encodeURIComponent(text)}`;
const getNames = (response: request.Response): string[] => response.body.data.items.map((item: { name: string }) => item.name);

describe('GET /v1/restaurants/search: market scope', () => {
  test('a budget search scoped to India returns no restaurants from other countries', async () => {
    const response = await searchRestaurants(`${searchText('under Rs. 5000 for two')}&country=India`);
    expect(response.status).toBe(200);
    expect(getNames(response)).not.toContain('Liberty Diner');
    expect(response.body.data.items.every((item: { country: string }) => item.country === 'India')).toBe(true);
    expect(response.body.data.interpreted).toMatchObject({ country: 'India', maxCostForTwo: 5000 });
  });
});

describe('GET /v1/restaurants/search: natural language', () => {
  test('Best restaurants in Gurgaon with South Indian Food', async () => {
    const response = await searchRestaurants(searchText('Best restaurants in Gurgaon with South Indian Food'));
    expect(getNames(response)).toEqual(['Dakshin Delight', 'Udupi Express']);
    expect(response.body.data.interpreted).toMatchObject({ city: 'Gurgaon', cuisines: ['South Indian'], sort: '-rating' });
  });

  test('Restaurants in Gurgaon under Rs. 1000 for two', async () => {
    const response = await searchRestaurants(searchText('Restaurants in Gurgaon under Rs. 1000 for two'));
    expect(getNames(response).sort()).toEqual(['Dakshin Delight', 'Dragon Wok', 'Udupi Express']);
  });

  test("Nearest place that serves Vada Pav with the user's location", async () => {
    const response = await searchRestaurants(`${searchText('Nearest place that serves Vada Pav')}&lat=19.07&lng=72.87`);
    expect(response.body.data.items[0].name).toBe('Vada Pav Corner');
    expect(typeof response.body.data.items[0].distanceKm).toBe('number');
  });

  test('nearest without a location returns 400 saying lat/lng is needed', async () => {
    const response = await searchRestaurants(searchText('Nearest place that serves Vada Pav'));
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/lat/);
  });

  test('a city alias works end to end', async () => {
    expect(getNames(await searchRestaurants(searchText('chinese in gurugram')))).toEqual(['Dragon Wok']);
  });

  test('explicit query parameters override what was parsed from q', async () => {
    const response = await searchRestaurants(`${searchText('chinese in Gurgaon')}&city=New Delhi`);
    expect(response.body.data.interpreted.city).toBe('New Delhi');
    expect(response.body.data.items).toEqual([]);
  });

  test('a restaurant name works as a query', async () => {
    expect(getNames(await searchRestaurants(searchText('dragon wok')))).toEqual(['Dragon Wok']);
  });

  test('q is length-limited', async () => {
    expect((await searchRestaurants(searchText('x'.repeat(201)))).status).toBe(400);
  });

  test('a null byte in q is a 400, not a 500', async () => {
    const response = await searchRestaurants('q=%00');
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/q must not contain control characters/);
  });
});

describe('GET /v1/restaurants/search: does everything list does', () => {
  test.each([
    'city=Gurgaon&sort=-rating',
    'cuisines=Chinese,North Indian',
    `lat=${GURGAON.lat}&lng=${GURGAON.lng}&maxDistanceKm=10`,
    'limit=2&page=2&sort=name',
  ])('returns the same items as /v1/restaurants for %s', async queryString => {
    const listed = (await request(testApp.app).get(`/v1/restaurants?${queryString}`)).body.data;
    const searched = (await searchRestaurants(queryString)).body.data;
    expect(searched.items).toEqual(listed.items);
    expect(searched.hasMore).toBe(listed.hasMore);
  });
});

describe('GET /v1/restaurants/search: combined phrases', () => {
  test('city, cuisine, budget and ranking in one sentence', async () => {
    const response = await searchRestaurants(searchText('best chinese in gurgaon under 600'));
    expect(getNames(response)).toEqual(['Dragon Wok']);
    expect(response.body.data.interpreted).toEqual({ city: 'Gurgaon', cuisines: ['Chinese'], maxCostForTwo: 600, sort: '-rating' });
  });

  test('several cuisines are matched with OR and ranked by rating', async () => {
    expect(getNames(await searchRestaurants(searchText('chinese or north indian')))).toEqual(['Punjab Grill', 'Dragon Wok']);
  });

  test('a price with a thousands separator', async () => {
    const response = await searchRestaurants(searchText('gurgaon under 1,000'));
    expect(response.body.data.interpreted.maxCostForTwo).toBe(1000);
    expect(getNames(response).sort()).toEqual(['Dakshin Delight', 'Dragon Wok', 'Udupi Express']);
  });

  test("'top rated in new delhi' picks New Delhi, not the 'delhi' alias leftover", async () => {
    const response = await searchRestaurants(searchText('top rated in new delhi'));
    expect(getNames(response)).toEqual(['Punjab Grill']);
    expect(response.body.data.interpreted).toEqual({ city: 'New Delhi', sort: '-rating' });
  });

  test('upper case text gives the same result as lower case', async () => {
    const upper = await searchRestaurants(searchText('BEST SOUTH INDIAN IN GURGAON'));
    const lower = await searchRestaurants(searchText('best south indian in gurgaon'));
    expect(upper.body.data).toEqual(lower.body.data);
  });
});

describe('GET /v1/restaurants/search: dishes', () => {
  test('a known dish finds restaurants by its cuisine without a location', async () => {
    const response = await searchRestaurants(searchText('vada pav'));
    expect(getNames(response)).toEqual(['Vada Pav Corner']);
    expect(response.body.data.interpreted).toMatchObject({ dish: 'vada pav', dishCuisine: 'Street Food' });
  });

  test('dosa maps to South Indian restaurants', async () => {
    expect(getNames(await searchRestaurants(searchText('places that serve dosa')))).toEqual(['Dakshin Delight', 'Udupi Express']);
  });
});

describe('GET /v1/restaurants/search: explicit parameters with q', () => {
  test('an explicit sort beats the ranking word in q', async () => {
    const response = await searchRestaurants(`${searchText('best south indian in gurgaon')}&sort=cost`);
    expect(getNames(response)).toEqual(['Udupi Express', 'Dakshin Delight']);
    expect(response.body.data.interpreted.sort).toBe('cost');
  });

  test('minRating narrows what q found', async () => {
    expect(getNames(await searchRestaurants(`${searchText('south indian in gurgaon')}&minRating=4`))).toEqual(['Dakshin Delight']);
  });

  test('nearest with a radius only returns places inside it', async () => {
    const response = await searchRestaurants(`${searchText('nearest south indian')}&lat=${GURGAON.lat}&lng=${GURGAON.lng}&maxDistanceKm=1`);
    expect(getNames(response)).toEqual(['Dakshin Delight']);
    expect(response.body.data.items[0].distanceKm).toBeLessThan(1);
  });

  test("'within 1 km' in q is a radius, not a ₹1 budget", async () => {
    const response = await searchRestaurants(`${searchText('nearest south indian within 1 km')}&lat=${GURGAON.lat}&lng=${GURGAON.lng}`);
    expect(response.body.data.interpreted).toMatchObject({ maxDistanceKm: 1 });
    expect(response.body.data.interpreted.maxCostForTwo).toBeUndefined();
    expect(getNames(response)).toEqual(['Dakshin Delight']);
  });

  test('restaurants without a location never appear in nearest results', async () => {
    const response = await searchRestaurants(`${searchText('nearest cafe')}&lat=${GURGAON.lat}&lng=${GURGAON.lng}`);
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});

describe('GET /v1/restaurants/search: paging and response shape', () => {
  test('pages through search results with hasMore', async () => {
    const firstPage = (await searchRestaurants(`${searchText('restaurants in gurgaon')}&limit=1&page=1`)).body.data;
    expect(firstPage.items.map((item: { name: string }) => item.name)).toEqual(['Dakshin Delight']);
    expect(firstPage.hasMore).toBe(true);

    const lastPage = (await searchRestaurants(`${searchText('restaurants in gurgaon')}&limit=1&page=3`)).body.data;
    expect(lastPage.items.map((item: { name: string }) => item.name)).toEqual(['Udupi Express']);
    expect(lastPage.hasMore).toBe(false);
  });

  test('interpreted shows the filters but not page or limit', async () => {
    const interpreted = (await searchRestaurants(`${searchText('chinese')}&limit=5`)).body.data.interpreted;
    expect(interpreted).not.toHaveProperty('page');
    expect(interpreted).not.toHaveProperty('limit');
  });

  test('without q it returns the same as the list endpoint', async () => {
    const listed = (await request(testApp.app).get('/v1/restaurants')).body.data;
    const searched = (await searchRestaurants('')).body.data;
    expect(searched.items).toEqual(listed.items);
  });

  test('a search with no matches is an empty 200, not an error', async () => {
    const response = await searchRestaurants(searchText('chinese in noida'));
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});

describe('GET /v1/restaurants/search: bad input', () => {
  test('regex characters in q are treated as plain text', async () => {
    const response = await searchRestaurants(searchText('((('));
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });

  test.each(['foo=bar', 'lat=95&lng=77', 'sort=bogus', 'limit=0', 'minRating=-1'])('%s returns 400', async queryString => {
    expect((await searchRestaurants(`${searchText('chinese')}&${queryString}`)).status).toBe(400);
  });
});

describe('GET /v1/restaurants/search: places', () => {
  test('"near <locality>" sorts by distance from that locality', async () => {
    const response = await searchRestaurants(searchText('south indian near sector 29'));
    expect(response.status).toBe(200);
    expect(getNames(response)).toEqual(['Dakshin Delight', 'Udupi Express']);
    expect(response.body.data.items[0].distanceKm).toBe(0);
    expect(response.body.data.interpreted).toMatchObject({ place: 'sector 29', lat: 28.46, lng: 77.027 });
  });

  test('the place lookup ignores case', async () => {
    const response = await searchRestaurants('place=CONNAUGHT%20PLACE&limit=1');
    expect(getNames(response)).toEqual(['Punjab Grill']);
  });

  test('a place works with a radius', async () => {
    const response = await searchRestaurants('place=Connaught%20Place&maxDistanceKm=5');
    expect(getNames(response)).toEqual(['Punjab Grill']);
  });

  test('the list endpoint accepts place too', async () => {
    const response = await request(testApp.app).get('/v1/restaurants?place=Sector%2029&sort=distance&limit=1');
    expect(response.status).toBe(200);
    expect(getNames(response)).toEqual(['Dakshin Delight']);
  });

  test('"best near <place>" stays near the place instead of ranking the whole country', async () => {
    const response = await searchRestaurants(searchText('best restaurants near sector 29'));
    expect(response.status).toBe(200);
    expect(getNames(response)).toEqual(['Dakshin Delight', 'Udupi Express']);
    expect(response.body.data.interpreted).toMatchObject({ place: 'sector 29', sort: '-rating', maxDistanceKm: 5 });
  });

  test('an explicit radius beats the default place radius', async () => {
    const response = await searchRestaurants(`${searchText('best restaurants near sector 29')}&maxDistanceKm=50`);
    expect(getNames(response)[0]).toBe('Punjab Grill');
    expect(response.body.data.interpreted.maxDistanceKm).toBe(50);
  });

  test('an unknown place is a 404', async () => {
    const response = await searchRestaurants(searchText('chinese near atlantis'));
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Could not find a place called "atlantis"');
  });
});
