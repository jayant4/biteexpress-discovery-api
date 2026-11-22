import { buildSearchVocabulary, parseSearchQuery } from '@utils/parseSearchQuery';

const vocabulary = buildSearchVocabulary(
  ['Gurgaon', 'New Delhi', 'Mumbai', 'Bangalore'],
  ['South Indian', 'North Indian', 'Indian', 'Chinese', 'Street Food', 'Pizza', 'Cafe'],
);

describe('parseSearchQuery', () => {
  test('Best restaurants in Gurgaon with South Indian Food', () => {
    expect(parseSearchQuery('Best restaurants in Gurgaon with South Indian Food', vocabulary)).toEqual({
      city: 'Gurgaon',
      cuisines: ['South Indian'],
      sort: '-rating',
    });
  });

  test('Restaurants in Gurgaon under Rs. 1000 for two', () => {
    expect(parseSearchQuery('Restaurants in Gurgaon under Rs. 1000 for two', vocabulary)).toEqual({ city: 'Gurgaon', maxCostForTwo: 1000 });
  });

  test('Nearest place that serves Vada Pav', () => {
    expect(parseSearchQuery('Nearest place that serves Vada Pav', vocabulary)).toEqual({
      sort: 'distance',
      dish: 'vada pav',
      dishCuisine: 'Street Food',
    });
  });

  test.each([
    ['below ₹500', 500],
    ['less than 1,200', 1200],
    ['under rs 750 for two', 750],
    ['within INR 2000', 2000],
  ])('price: %s is %i', (query, maxCostForTwo) => {
    expect(parseSearchQuery(query, vocabulary).maxCostForTwo).toBe(maxCostForTwo);
  });

  test.each([
    ['within 5 km', 5],
    ['within 1.5 kms', 1.5],
    ['within 2 kilometres', 2],
  ])('distance, not price: %s is a %f km radius', (query, maxDistanceKm) => {
    const filters = parseSearchQuery(query, vocabulary);
    expect(filters.maxDistanceKm).toBe(maxDistanceKm);
    expect(filters.maxCostForTwo).toBeUndefined();
  });

  test('a radius and a budget in one sentence are told apart', () => {
    expect(parseSearchQuery('chinese within 2 km under 500', vocabulary)).toEqual({ cuisines: ['Chinese'], maxDistanceKm: 2, maxCostForTwo: 500 });
  });

  test('resolves city aliases: gurugram is Gurgaon, bengaluru is Bangalore', () => {
    expect(parseSearchQuery('chinese in gurugram', vocabulary)).toEqual({ city: 'Gurgaon', cuisines: ['Chinese'] });
    expect(parseSearchQuery('pizza in Bengaluru', vocabulary).city).toBe('Bangalore');
  });

  test("prefers the longest match: 'South Indian' is not also 'Indian'", () => {
    expect(parseSearchQuery('south indian', vocabulary).cuisines).toEqual(['South Indian']);
  });

  test("'New Delhi' wins over the 'delhi' alias", () => {
    expect(parseSearchQuery('cafe in new delhi', vocabulary).city).toBe('New Delhi');
  });

  test('finds several cuisines', () => {
    expect(parseSearchQuery('chinese or north indian', vocabulary).cuisines?.sort()).toEqual(['Chinese', 'North Indian']);
  });

  test("matches whole words only: 'cafeteria' is not 'Cafe'", () => {
    expect(parseSearchQuery('cafeteria', vocabulary).cuisines).toBeUndefined();
  });

  test("an unknown dish after 'serves' becomes a dish search", () => {
    expect(parseSearchQuery('place that serves paneer tikka', vocabulary)).toEqual({ dish: 'paneer tikka' });
  });

  test('nothing recognisable falls back to a name search', () => {
    expect(parseSearchQuery('Dragon Wok', vocabulary)).toEqual({ name: 'Dragon Wok' });
  });

  test('"near <place>" becomes a place to geocode, and stops before "in <city>"', () => {
    expect(parseSearchQuery('south indian near sector 29 in gurgaon', vocabulary)).toEqual({
      place: 'sector 29',
      city: 'Gurgaon',
      cuisines: ['South Indian'],
    });
  });

  test('"near me" still means nearest-first, not a place', () => {
    expect(parseSearchQuery('pizza near me', vocabulary)).toEqual({ sort: 'distance', cuisines: ['Pizza'] });
  });

  test('"around <place>" works like "near <place>"', () => {
    expect(parseSearchQuery('best biryani around connaught place', vocabulary)).toMatchObject({ place: 'connaught place', sort: '-rating' });
  });

  test('empty or whitespace gives no filters', () => {
    expect(parseSearchQuery('', vocabulary)).toEqual({});
    expect(parseSearchQuery('   ', vocabulary)).toEqual({});
  });

  test.each([
    ['top rated pizza', '-rating'],
    ['highest rated cafe', '-rating'],
    ['closest pizza', 'distance'],
    ['pizza near me', 'distance'],
    ['best and nearest pizza', 'distance'],
  ])('ranking words: %s sorts by %s', (query, sort) => {
    expect(parseSearchQuery(query, vocabulary).sort).toBe(sort);
  });

  test("resolves the 'bombay' alias to Mumbai", () => {
    expect(parseSearchQuery('street food in bombay', vocabulary)).toEqual({ city: 'Mumbai', cuisines: ['Street Food'] });
  });

  test("'up to' is read as a budget", () => {
    expect(parseSearchQuery('pizza up to 500', vocabulary).maxCostForTwo).toBe(500);
  });

  test('a matched phrase is not counted twice', () => {
    expect(parseSearchQuery('north indian', vocabulary).cuisines).toEqual(['North Indian']);
  });
});
