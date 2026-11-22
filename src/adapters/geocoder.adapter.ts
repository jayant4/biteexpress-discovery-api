import { ILatLng } from '@interfaces/restaurant.interface';

export interface IGeocoder {
  name: string;
  geocode(place: string): Promise<ILatLng | null>;
}

export type TFindLocalityCentre = (locality: string) => Promise<ILatLng | null>;

export const supportedGeocoders = ['locality'];

export class LocalityGeocoder implements IGeocoder {
  public name = 'locality';

  constructor(private findLocalityCentre: TFindLocalityCentre) {}

  public async geocode(place: string): Promise<ILatLng | null> {
    return this.findLocalityCentre(place.trim());
  }
}

export const createGeocoder = (geocoderName: string, findLocalityCentre: TFindLocalityCentre): IGeocoder => {
  switch (geocoderName) {
    case 'locality':
      return new LocalityGeocoder(findLocalityCentre);
    default:
      throw new Error(`Unknown GEOCODER "${geocoderName}". Supported: ${supportedGeocoders.join(', ')}`);
  }
};
