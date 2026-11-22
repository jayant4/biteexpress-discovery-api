import { IParsedRestaurantFilters } from '@interfaces/restaurantFilters.interface';
import { escapeRegex } from '@utils/escapeRegex';

export const cityAliases: Record<string, string> = {
  gurugram: 'Gurgaon',
  bengaluru: 'Bangalore',
  bombay: 'Mumbai',
  delhi: 'New Delhi',
};

export const dishToCuisine: Record<string, string> = {
  'vada pav': 'Street Food',
  'pav bhaji': 'Street Food',
  dosa: 'South Indian',
  idli: 'South Indian',
  biryani: 'Biryani',
  momos: 'Tibetan',
  pizza: 'Pizza',
  burger: 'Burger',
};

const fillerWords = new Set('restaurant restaurants place places food foods show me find a an the in at with for of that to some good'.split(' '));

export interface ISearchPhrase {
  phrase: string;
  value: string;
}

export interface ISearchVocabulary {
  cities: ISearchPhrase[];
  cuisines: ISearchPhrase[];
}

const toPhrases = (entries: Record<string, string>): ISearchPhrase[] => Object.keys(entries).map(phrase => ({ phrase, value: entries[phrase] }));

const longestFirst = (phrases: ISearchPhrase[]): ISearchPhrase[] => phrases.sort((a, b) => b.phrase.length - a.phrase.length);

export const buildSearchVocabulary = (cities: string[], cuisines: string[]): ISearchVocabulary => ({
  cities: longestFirst([...cities.map(city => ({ phrase: city.toLowerCase(), value: city })), ...toPhrases(cityAliases)]),
  cuisines: longestFirst(cuisines.map(cuisine => ({ phrase: cuisine.toLowerCase(), value: cuisine }))),
});

const wholeWord = (phrase: string) => new RegExp(`(?<![a-z])${escapeRegex(phrase)}(?![a-z])`);

export const parseSearchQuery = (query: string, vocabulary: ISearchVocabulary): IParsedRestaurantFilters => {
  let remainingText = ` ${query.toLowerCase().replace(/\s+/g, ' ')} `;
  if (!remainingText.trim()) return {};
  const filters: IParsedRestaurantFilters = {};

  const takeMatch = (pattern: RegExp) => {
    const found = remainingText.match(pattern);
    if (found) remainingText = remainingText.replace(found[0], ' ');
    return found;
  };

  const radius = takeMatch(/\bwithin\s*(\d+(?:\.\d+)?)\s*(?:km|kms|kilomet(?:er|re)s?)\b/);
  if (radius && Number(radius[1]) > 0) filters.maxDistanceKm = Number(radius[1]);

  const price = takeMatch(/\b(?:under|below|less than|within|up ?to|max)\s*(?:rs\.?|₹|inr)?\s*([\d,]+)(?:\s*(?:rs|inr|rupees|₹))?(?![a-z\d]|\.\d)/);
  if (price?.[1]) filters.maxCostForTwo = Number(price[1].replaceAll(',', ''));

  const nearest = takeMatch(/\b(?:nearest|closest|near me|nearby)\b/);
  const nearPlace = takeMatch(/\b(?:near|around)\s+([a-z][a-z0-9 ]*?)\s+(?=(?:in|with|for|serving|that)\s|$)/);
  if (nearPlace?.[1]) filters.place = nearPlace[1].trim();
  const best = takeMatch(/\b(?:best|top rated|highest rated|top)\b/);
  if (nearest) filters.sort = 'distance';
  else if (best) filters.sort = '-rating';

  for (const city of vocabulary.cities) {
    if (takeMatch(wholeWord(city.phrase))) {
      filters.city = city.value;
      break;
    }
  }

  const cuisines = vocabulary.cuisines.filter(cuisine => takeMatch(wholeWord(cuisine.phrase))).map(cuisine => cuisine.value);
  if (cuisines.length) filters.cuisines = cuisines;

  for (const dish of longestFirst(toPhrases(dishToCuisine))) {
    if (takeMatch(wholeWord(dish.phrase))) {
      filters.dish = dish.phrase;
      filters.dishCuisine = dish.value;
      break;
    }
  }
  if (!filters.dish) {
    const served = takeMatch(/\bserv(?:es|ing)\s+([a-z][a-z ]*[a-z])/);
    if (served?.[1]) filters.dish = served[1].trim();
  }

  const leftoverWords = remainingText.split(' ').filter(word => word && !fillerWords.has(word));
  if (Object.keys(filters).length === 0 && leftoverWords.length) filters.name = query.trim();

  return filters;
};
