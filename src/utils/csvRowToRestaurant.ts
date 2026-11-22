import { ERestaurantSource, INewRestaurant, IRestaurantLocation } from '@interfaces/restaurant.interface';
import { currencyByCountryCode, toInr } from '@utils/currency';

export const countryNamesByCode: Record<number, string> = {
  1: 'India',
  14: 'Australia',
  30: 'Brazil',
  37: 'Canada',
  94: 'Indonesia',
  148: 'New Zealand',
  162: 'Phillipines',
  166: 'Qatar',
  184: 'Singapore',
  189: 'South Africa',
  191: 'Sri Lanka',
  208: 'Turkey',
  214: 'UAE',
  215: 'United Kingdom',
  216: 'United States',
};

const toText = (value: string | undefined) => (value ?? '').trim();
const isYes = (value: string | undefined) => toText(value).toLowerCase() === 'yes';
const toNumber = (value: string | undefined) => {
  const parsed = Number(toText(value));
  return toText(value) !== '' && Number.isFinite(parsed) ? parsed : undefined;
};

const toLocation = (longitude?: string, latitude?: string): IRestaurantLocation | undefined => {
  const lng = toNumber(longitude);
  const lat = toNumber(latitude);
  if (lng === undefined || lat === undefined) return undefined;
  if (lng === 0 && lat === 0) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { type: 'Point', coordinates: [lng, lat] };
};

export const csvRowToRestaurant = (row: Record<string, string>): INewRestaurant => {
  const countryCode = toNumber(row['Country Code']);
  const rating = toNumber(row['Aggregate rating']);
  const location = toLocation(row.Longitude, row.Latitude);
  const costForTwo = toNumber(row['Average Cost for two']);
  const currency = countryCode !== undefined ? currencyByCountryCode[countryCode] : undefined;
  return {
    externalId: toNumber(row['Restaurant ID']),
    source: ERestaurantSource.Zomato,
    name: toText(row['Restaurant Name']),
    address: toText(row.Address),
    locality: toText(row.Locality),
    localityVerbose: toText(row['Locality Verbose']),
    city: toText(row.City),
    country: (countryCode !== undefined && countryNamesByCode[countryCode]) || 'Unknown',
    countryCode,
    ...(location && { location }),
    cuisines: toText(row.Cuisines)
      .split(',')
      .map(cuisine => cuisine.trim())
      .filter(Boolean),
    costForTwo,
    costForTwoInr: toInr(costForTwo, currency),
    currency,
    priceRange: toNumber(row['Price range']),
    flags: {
      hasTableBooking: isYes(row['Has Table booking']),
      hasOnlineDelivery: isYes(row['Has Online delivery']),
      isDeliveringNow: isYes(row['Is delivering now']),
    },
    rating: {
      aggregate: rating && toText(row['Rating text']) !== 'Not rated' ? rating : null,
      text: toText(row['Rating text']),
      color: toText(row['Rating color']),
      votes: toNumber(row.Votes) ?? 0,
    },
  };
};
