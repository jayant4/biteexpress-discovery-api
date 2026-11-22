import { GURGAON, ITestApp, setupTestApp } from '../helpers/setupTestApp';
import request from 'supertest';

let testApp: ITestApp;

beforeAll(async () => {
  testApp = await setupTestApp();
}, 120000);

afterAll(() => testApp.stopTestApp());

const listRestaurants = (queryString: string) => request(testApp.app).get(`/v1/restaurants?${queryString}`);
const getNames = (response: request.Response): string[] => response.body.data.items.map((item: { name: string }) => item.name);
const nearGurgaon = `lat=${GURGAON.lat}&lng=${GURGAON.lng}`;

describe('GET /v1/restaurants: filters', () => {
  test('city is case-insensitive', async () => {
    for (const city of ['Gurgaon', 'gurgaon', 'GURGAON']) {
      expect(getNames(await listRestaurants(`city=${city}`)).sort()).toEqual(['Dakshin Delight', 'Dragon Wok', 'Udupi Express']);
    }
  });

  test('cuisines matches any of a comma-separated list', async () => {
    expect(getNames(await listRestaurants('cuisines=Chinese,North Indian')).sort()).toEqual(['Dragon Wok', 'Punjab Grill']);
  });

  test('name is a partial, case-insensitive match', async () => {
    expect(getNames(await listRestaurants('name=wok'))).toEqual(['Dragon Wok']);
  });

  test('minRating and maxCostForTwo', async () => {
    expect(getNames(await listRestaurants('minRating=4.4')).sort()).toEqual(['Dakshin Delight', 'Punjab Grill']);
    expect(getNames(await listRestaurants('maxCostForTwo=400')).sort()).toEqual(['Ghost Cafe', 'Udupi Express', 'Vada Pav Corner']);
  });
});

describe('GET /v1/restaurants: market scope', () => {
  test('country limits results to one market and ignores case', async () => {
    const names = getNames(await listRestaurants('country=india&maxCostForTwo=5000'));
    expect(names).not.toContain('Liberty Diner');
    expect(names.length).toBeGreaterThan(0);
    expect(getNames(await listRestaurants('country=United States'))).toEqual(['Liberty Diner']);
  });

  test('an empty country is rejected', async () => {
    expect((await listRestaurants('country=')).status).toBe(400);
  });
});

describe('GET /v1/restaurants: prices across currencies', () => {
  test('maxCostForTwo is in rupees, so a $50 restaurant is not "under 400"', async () => {
    expect(getNames(await listRestaurants('maxCostForTwo=400'))).not.toContain('Liberty Diner');
    expect(getNames(await listRestaurants('maxCostForTwo=5000'))).toContain('Liberty Diner');
  });

  test('sort=cost compares rupee prices', async () => {
    expect(getNames(await listRestaurants('sort=cost&limit=2'))).toEqual(['Vada Pav Corner', 'Ghost Cafe']);
    expect(getNames(await listRestaurants('sort=-cost&limit=1'))).toEqual(['Liberty Diner']);
  });
});

describe('GET /v1/restaurants: sorting and distance', () => {
  test('sort=-rating puts the best first', async () => {
    expect(getNames(await listRestaurants('sort=-rating'))[0]).toBe('Punjab Grill');
  });

  test('sort=name is alphabetical', async () => {
    const names = getNames(await listRestaurants('sort=name'));
    expect(names).toEqual([...names].sort());
  });

  test('with lat/lng: distanceKm is present, ascending, and rows without a location are excluded', async () => {
    const response = await listRestaurants(nearGurgaon);
    const distances: number[] = response.body.data.items.map((item: { distanceKm: number }) => item.distanceKm);
    expect(distances.every(distance => typeof distance === 'number')).toBe(true);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(getNames(response)[0]).toBe('Dakshin Delight');
    expect(getNames(response)).not.toContain('Ghost Cafe');
  });

  test('maxDistanceKm limits the radius', async () => {
    expect(getNames(await listRestaurants(`${nearGurgaon}&maxDistanceKm=2`))).toEqual(['Dakshin Delight', 'Udupi Express']);
  });

  test('combines distance with other filters', async () => {
    expect(getNames(await listRestaurants(`${nearGurgaon}&cuisines=Chinese`))).toEqual(['Dragon Wok']);
  });

  test('without lat/lng there is no distanceKm', async () => {
    const response = await listRestaurants('city=Gurgaon');
    expect(response.body.data.items[0]).not.toHaveProperty('distanceKm');
  });
});

describe('GET /v1/restaurants: bad input', () => {
  test('sort=distance without coordinates returns 400 mentioning lat', async () => {
    const response = await listRestaurants('sort=distance');
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/lat/);
  });

  test('lat without lng returns 400', async () => {
    expect((await listRestaurants('lat=28.4')).status).toBe(400);
  });

  test.each(['page=0', 'page=-1', 'limit=0', 'minRating=9', 'sort=bogus', 'lat=abc&lng=1'])('%s returns 400', async queryString => {
    expect((await listRestaurants(queryString)).status).toBe(400);
  });

  test.each(['name=%00', 'city=a%00b', 'country=%01', 'cuisines=Chinese,%00', 'place=%00x'])(
    'control characters in text (%s) are a 400, not a 500',
    async queryString => {
      const response = await listRestaurants(queryString);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/control characters/);
    },
  );

  test('a page too large to skip to is a 400, not a 500', async () => {
    const response = await listRestaurants('page=99999999999999999999');
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/page must not be greater than 1000/);
    expect((await listRestaurants('page=1000')).status).toBe(200);
  });
});

describe('GET /v1/restaurants: response and paging', () => {
  test('each item has the required fields', async () => {
    const response = await listRestaurants('');
    for (const item of response.body.data.items) {
      for (const key of ['id', 'name', 'address', 'city', 'country', 'cuisines', 'avgRating']) {
        expect(item).toHaveProperty(key);
      }
    }
  });

  test('caps limit at 50 instead of rejecting it', async () => {
    expect((await listRestaurants('limit=100000')).body.data.limit).toBe(50);
  });

  test('hasMore tells the client whether to ask for the next page', async () => {
    expect((await listRestaurants('limit=2&page=1')).body.data.hasMore).toBe(true);
    const lastPage = (await listRestaurants('limit=2&page=4')).body.data;
    expect(lastPage.items).toHaveLength(1);
    expect(lastPage.hasMore).toBe(false);
  });

  test('pages do not overlap', async () => {
    const firstPage = getNames(await listRestaurants('limit=3&page=1&sort=-rating'));
    const secondPage = getNames(await listRestaurants('limit=3&page=2&sort=-rating'));
    expect(firstPage.filter(name => secondPage.includes(name))).toEqual([]);
  });
});
