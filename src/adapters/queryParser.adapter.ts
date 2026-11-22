import { ICitiesAndCuisines } from '@interfaces/restaurant.interface';
import { IParsedRestaurantFilters } from '@interfaces/restaurantFilters.interface';
import { buildSearchVocabulary, ISearchVocabulary, parseSearchQuery } from '@utils/parseSearchQuery';

export interface IQueryParser {
  name: string;
  parse(query: string): Promise<IParsedRestaurantFilters>;
}

export type TLoadVocabulary = () => Promise<ICitiesAndCuisines>;

export const supportedQueryParsers = ['rules'];

export class RuleBasedQueryParser implements IQueryParser {
  public name = 'rules';
  private vocabulary?: ISearchVocabulary;
  private vocabularyLoadedAt = 0;

  constructor(
    private loadVocabulary: TLoadVocabulary,
    private vocabularyTtlMs = 60000,
  ) {}

  public async parse(query: string): Promise<IParsedRestaurantFilters> {
    return parseSearchQuery(query, await this.getVocabulary());
  }

  private async getVocabulary(): Promise<ISearchVocabulary> {
    if (!this.vocabulary || Date.now() - this.vocabularyLoadedAt > this.vocabularyTtlMs) {
      const { cities, cuisines } = await this.loadVocabulary();
      this.vocabulary = buildSearchVocabulary(cities, cuisines);
      this.vocabularyLoadedAt = Date.now();
    }
    return this.vocabulary;
  }
}

export const createQueryParser = (parserName: string, loadVocabulary: TLoadVocabulary): IQueryParser => {
  switch (parserName) {
    case 'rules':
      return new RuleBasedQueryParser(loadVocabulary);
    default:
      throw new Error(`Unknown NL_PARSER "${parserName}". Supported: ${supportedQueryParsers.join(', ')}`);
  }
};
