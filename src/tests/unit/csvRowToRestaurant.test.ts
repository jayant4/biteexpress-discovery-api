import { csvRowToRestaurant } from '@utils/csvRowToRestaurant';
import { toInr } from '@utils/currency';

const csvRow = {
  'Restaurant ID': '6317637',
  'Restaurant Name': 'Le Petit Souffle',
  'Country Code': '1',
  City: 'Gurgaon',
  Address: 'Sector 29, Gurgaon',
  Locality: 'Sector 29',
  'Locality Verbose': 'Sector 29, Gurgaon',
  Longitude: '77.1',
  Latitude: '28.4',
  Cuisines: 'North Indian, Chinese',
  'Average Cost for two': '1100',
  Currency: 'Indian Rupees(Rs.)',
  'Has Table booking': 'Yes',
  'Has Online delivery': 'No',
  'Is delivering now': 'No',
  'Switch to order menu': 'No',
  'Price range': '3',
  'Aggregate rating': '4.8',
  'Rating color': 'Dark Green',
  'Rating text': 'Excellent',
  Votes: '314',
};

describe('csvRowToRestaurant', () => {
  test('maps a full row into the restaurant shape', () => {
    expect(csvRowToRestaurant(csvRow)).toEqual({
      externalId: 6317637,
      source: 'zomato',
      name: 'Le Petit Souffle',
      address: 'Sector 29, Gurgaon',
      locality: 'Sector 29',
      localityVerbose: 'Sector 29, Gurgaon',
      city: 'Gurgaon',
      country: 'India',
      countryCode: 1,
      location: { type: 'Point', coordinates: [77.1, 28.4] },
      cuisines: ['North Indian', 'Chinese'],
      costForTwo: 1100,
      costForTwoInr: 1100,
      currency: 'INR',
      priceRange: 3,
      flags: { hasTableBooking: true, hasOnlineDelivery: false, isDeliveringNow: false },
      rating: { aggregate: 4.8, text: 'Excellent', color: 'Dark Green', votes: 314 },
    });
  });

  test('drops location for 0,0 coordinates', () => {
    expect(csvRowToRestaurant({ ...csvRow, Longitude: '0', Latitude: '0' }).location).toBeUndefined();
  });

  test('drops location for unparseable or out-of-range coordinates', () => {
    expect(csvRowToRestaurant({ ...csvRow, Longitude: '', Latitude: '' }).location).toBeUndefined();
    expect(csvRowToRestaurant({ ...csvRow, Latitude: '95' }).location).toBeUndefined();
  });

  test('the currency comes from the country code, not the unreliable label', () => {
    const unitedStates = csvRowToRestaurant({ ...csvRow, 'Country Code': '216', 'Average Cost for two': '50', Currency: 'Dollar($)' });
    expect(unitedStates).toMatchObject({ currency: 'USD', costForTwo: 50, costForTwoInr: toInr(50, 'USD') });
    expect(csvRowToRestaurant({ ...csvRow, 'Country Code': '162', Currency: 'Botswana Pula(P)' }).currency).toBe('PHP');
  });

  test('an unknown country leaves currency and rupee price out', () => {
    const unknownCountry = csvRowToRestaurant({ ...csvRow, 'Country Code': '999' });
    expect(unknownCountry.currency).toBeUndefined();
    expect(unknownCountry.costForTwoInr).toBeUndefined();
  });

  test('empty cuisines become an empty array', () => {
    expect(csvRowToRestaurant({ ...csvRow, Cuisines: '' }).cuisines).toEqual([]);
  });

  test("'Not rated' with 0 becomes a null rating, not zero stars", () => {
    expect(csvRowToRestaurant({ ...csvRow, 'Aggregate rating': '0', 'Rating text': 'Not rated' }).rating.aggregate).toBeNull();
  });

  test('trims stray whitespace in text fields', () => {
    expect(csvRowToRestaurant({ ...csvRow, City: '  Gurgaon ' }).city).toBe('Gurgaon');
  });

  test("an unknown country code becomes 'Unknown'", () => {
    expect(csvRowToRestaurant({ ...csvRow, 'Country Code': '999' }).country).toBe('Unknown');
  });
});
