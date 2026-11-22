import { ILatLng } from '@interfaces/restaurant.interface';
import { IRestaurantSummary } from '@interfaces/restaurantFilters.interface';

export interface IDistanceRanker {
  name: string;
  reorders: boolean;
  rank(origin: ILatLng, restaurants: IRestaurantSummary[]): Promise<IRestaurantSummary[]>;
}

export const supportedDistanceRankers = ['straight-line'];

export class StraightLineDistanceRanker implements IDistanceRanker {
  public name = 'straight-line';
  public reorders = false;

  public async rank(_origin: ILatLng, restaurants: IRestaurantSummary[]): Promise<IRestaurantSummary[]> {
    return restaurants;
  }
}

export const createDistanceRanker = (rankerName: string): IDistanceRanker => {
  switch (rankerName) {
    case 'straight-line':
      return new StraightLineDistanceRanker();
    default:
      throw new Error(`Unknown DISTANCE_RANKER "${rankerName}". Supported: ${supportedDistanceRankers.join(', ')}`);
  }
};
