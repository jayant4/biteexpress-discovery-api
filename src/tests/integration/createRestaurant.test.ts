import { ITestApp, setupTestApp } from '../helpers/setupTestApp';
import { approximateInrPerCurrencyUnit } from '@utils/currency';
import request from 'supertest';

let testApp: ITestApp;

beforeAll(async () => {
  testApp = await setupTestApp();
}, 120000);

afterAll(() => testApp.stopTestApp());

const validRestaurant = {
  name: 'Idli House',
  address: 'Sector 14',
  city: 'Gurgaon',
  country: 'India',
  cuisines: ['South Indian'],
  lat: 28.47,
  lng: 77.03,
  costForTwo: 300,
  avgRating: 4.0,
};

describe('POST /v1/restaurants', () => {
  test('creates a restaurant and returns it with an id', async () => {
    const response = await request(testApp.app).post('/v1/restaurants').send(validRestaurant);
    expect(response.status).toBe(201);
    const createdRestaurant = response.body.data;
    expect(createdRestaurant.id).toMatch(/^[0-9a-f]{24}$/);
    expect(createdRestaurant).toMatchObject({ name: 'Idli House', lat: 28.47, lng: 77.03, avgRating: 4 });
    expect(createdRestaurant.source).toBe('api');
    expect(createdRestaurant).not.toHaveProperty('_id');
    expect(createdRestaurant).not.toHaveProperty('__v');

    const fetched = await request(testApp.app).get(`/v1/restaurants/${createdRestaurant.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data).toEqual(createdRestaurant);
  });

  test('stores the price in rupees too, defaulting the currency to INR', async () => {
    const response = await request(testApp.app).post('/v1/restaurants').send(validRestaurant);
    expect(response.body.data).toMatchObject({ costForTwo: 300, currency: 'INR', costForTwoInr: 300 });
  });

  test('converts a price given in another currency', async () => {
    const response = await request(testApp.app)
      .post('/v1/restaurants')
      .send({ ...validRestaurant, city: 'New York', country: 'United States', costForTwo: 20, currency: 'USD' });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ currency: 'USD', costForTwoInr: Math.round(20 * approximateInrPerCurrencyUnit.USD) });
  });

  test('rejects a currency it cannot convert', async () => {
    const response = await request(testApp.app)
      .post('/v1/restaurants')
      .send({ ...validRestaurant, currency: 'Dollar($)' });
    expect(response.status).toBe(400);
  });

  test.each([
    ['empty name', { ...validRestaurant, name: '' }],
    ['latitude out of range', { ...validRestaurant, lat: 200 }],
    ['lat without lng', { ...validRestaurant, lng: undefined }],
    ['rating above 5', { ...validRestaurant, avgRating: 7 }],
    ['missing city', { ...validRestaurant, city: undefined }],
  ])('rejects %s with 400', async (_label, restaurantData) => {
    const response = await request(testApp.app).post('/v1/restaurants').send(restaurantData);
    expect(response.status).toBe(400);
  });
});

describe('GET /v1/restaurants/:id', () => {
  test('returns 404 for a well-formed id that does not exist', async () => {
    const response = await request(testApp.app).get('/v1/restaurants/000000000000000000000000');
    expect(response.status).toBe(404);
  });

  test.each(['abc', 'abcdefghijkl'])('returns 404 for the malformed id %s', async restaurantId => {
    const response = await request(testApp.app).get(`/v1/restaurants/${restaurantId}`);
    expect(response.status).toBe(404);
  });
});

describe('GET /healthz', () => {
  test('is ok when MongoDB answers a ping', async () => {
    const response = await request(testApp.app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'OK' });
  });
});
