import { IRestaurantFilters } from '@interfaces/restaurantFilters.interface';
import { buildRestaurantPipeline } from '@utils/buildRestaurantPipeline';

const defaultFilters: IRestaurantFilters = { sort: 'relevance', page: 1, limit: 20 };

const findStage = (pipeline: object[], operator: string) =>
  (pipeline.find(stage => operator in stage) as Record<string, any> | undefined)?.[operator];

describe('buildRestaurantPipeline', () => {
  test('filters by country when one is given', () => {
    expect(buildRestaurantPipeline({ ...defaultFilters, country: 'India' })[0]).toEqual({ $match: { country: 'India' } });
  });

  test('starts with $match when no coordinates are given', () => {
    expect(buildRestaurantPipeline({ ...defaultFilters, city: 'Gurgaon' })[0]).toEqual({ $match: { city: 'Gurgaon' } });
  });

  test('starts with $geoNear and puts the other filters inside it when coordinates are given', () => {
    const geoNear = findStage(buildRestaurantPipeline({ ...defaultFilters, lat: 28.4, lng: 77.1, cuisines: ['Chinese'] }), '$geoNear');
    expect(geoNear.near).toEqual({ type: 'Point', coordinates: [77.1, 28.4] });
    expect(geoNear.query).toEqual({ cuisines: { $in: ['Chinese'] } });
    expect(geoNear.distanceField).toBe('distanceM');
    expect(geoNear.key).toBe('location');
    expect(geoNear.spherical).toBe(true);
  });

  test('$geoNear is the very first stage', () => {
    expect(Object.keys(buildRestaurantPipeline({ ...defaultFilters, lat: 1, lng: 2 })[0] ?? {})).toEqual(['$geoNear']);
  });

  test('converts maxDistanceKm to metres', () => {
    const geoNear = findStage(buildRestaurantPipeline({ ...defaultFilters, lat: 1, lng: 2, maxDistanceKm: 2 }), '$geoNear');
    expect(geoNear.maxDistance).toBe(2000);
  });

  test('caps limit at 50 and computes skip from page', () => {
    expect(findStage(buildRestaurantPipeline({ ...defaultFilters, limit: 500 }), '$limit')).toBe(50);
    expect(findStage(buildRestaurantPipeline({ ...defaultFilters, page: 3, limit: 20 }), '$skip')).toBe(40);
  });

  test('can fetch one extra row so the API can tell if there is a next page', () => {
    expect(findStage(buildRestaurantPipeline({ ...defaultFilters, limit: 20 }, { extra: 1 }), '$limit')).toBe(21);
  });

  test('sorts by rating descending with _id as a tie-breaker', () => {
    expect(findStage(buildRestaurantPipeline({ ...defaultFilters, sort: '-rating' }), '$sort')).toEqual({ 'rating.aggregate': -1, _id: 1 });
  });

  test('cost sorts on the rupee price so currencies compare fairly', () => {
    expect(findStage(buildRestaurantPipeline({ ...defaultFilters, sort: 'cost' }), '$sort')).toEqual({ costForTwoInr: 1, _id: 1 });
  });

  test('relevance with coordinates has no $sort', () => {
    expect(findStage(buildRestaurantPipeline({ ...defaultFilters, lat: 1, lng: 2 }), '$sort')).toBeUndefined();
  });

  test('relevance without coordinates sorts by best rating', () => {
    expect(findStage(buildRestaurantPipeline(defaultFilters), '$sort')).toEqual({ 'rating.aggregate': -1, _id: 1 });
  });

  test('escapes regex characters in name', () => {
    const match = findStage(buildRestaurantPipeline({ ...defaultFilters, name: 'a.b' }), '$match');
    expect(match.name).toEqual({ $regex: 'a\\.b', $options: 'i' });
  });

  test('dish matches name or cuisines, plus the mapped cuisine', () => {
    const match = findStage(buildRestaurantPipeline({ ...defaultFilters, dish: 'vada pav', dishCuisine: 'Street Food' }), '$match');
    const dishPattern = { $regex: 'vada pav', $options: 'i' };
    expect(match.$or).toEqual([{ name: dishPattern }, { cuisines: dishPattern }, { cuisines: 'Street Food' }]);
  });

  test('applies minRating and maxCostForTwo as ranges', () => {
    const match = findStage(buildRestaurantPipeline({ ...defaultFilters, minRating: 4, maxCostForTwo: 1000 }), '$match');
    expect(match).toEqual({ 'rating.aggregate': { $gte: 4 }, costForTwoInr: { $lte: 1000 } });
  });

  test('projects only the fields the list response needs, as the last stage', () => {
    const pipeline = buildRestaurantPipeline(defaultFilters);
    expect(Object.keys(pipeline[pipeline.length - 1])).toEqual(['$project']);
    expect(Object.keys(findStage(pipeline, '$project')).sort()).toEqual(
      ['address', 'city', 'country', 'cuisines', 'distanceM', 'name', 'rating.aggregate'].sort(),
    );
  });
});
