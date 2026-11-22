import { connectToDatabase, disconnectFromDatabase } from '@databases';
import { IRestaurantFilters } from '@interfaces/restaurantFilters.interface';
import restaurantModel from '@models/restaurant.model';
import { buildRestaurantPipeline } from '@utils/buildRestaurantPipeline';
import { logger } from '@utils/logger';

interface IPlanSummary {
  stages: Set<string>;
  keysExamined: number;
  docsExamined: number;
  returned: number;
}

const defaultFilters: IRestaurantFilters = { sort: 'relevance', page: 1, limit: 20 };

const queryCases: [string, IRestaurantFilters][] = [
  ['best in a city', { ...defaultFilters, city: 'Gurgaon', sort: '-rating' }],
  ['best for a cuisine', { ...defaultFilters, cuisines: ['South Indian'], sort: '-rating' }],
  ['nearest with a cuisine', { ...defaultFilters, lat: 28.4595, lng: 77.0266, cuisines: ['Chinese'] }],
];

const summarizePlan = (node: unknown, summary: IPlanSummary): IPlanSummary => {
  if (Array.isArray(node)) {
    node.forEach(item => summarizePlan(item, summary));
  } else if (node && typeof node === 'object') {
    const planNode = node as Record<string, any>;
    if (typeof planNode.stage === 'string') summary.stages.add(planNode.stage);
    if (typeof planNode.totalKeysExamined === 'number') summary.keysExamined = Math.max(summary.keysExamined, planNode.totalKeysExamined);
    if (typeof planNode.totalDocsExamined === 'number') summary.docsExamined = Math.max(summary.docsExamined, planNode.totalDocsExamined);
    if (typeof planNode.nReturned === 'number') summary.returned = Math.max(summary.returned, planNode.nReturned);
    Object.values(planNode).forEach(value => summarizePlan(value, summary));
  }
  return summary;
};

const getVerdict = (stages: Set<string>) => {
  if (stages.has('COLLSCAN')) return 'COLLECTION SCAN';
  if ([...stages].some(stage => stage === 'IXSCAN' || stage.startsWith('GEO_NEAR'))) return 'index used';
  return 'no index stage seen';
};

const explainRestaurantQueries = async () => {
  await connectToDatabase();
  for (const [label, filters] of queryCases) {
    const plan = await restaurantModel.aggregate(buildRestaurantPipeline(filters)).explain('executionStats');
    const summary = summarizePlan(plan, { stages: new Set(), keysExamined: 0, docsExamined: 0, returned: 0 });
    logger.info(
      `${label.padEnd(24)} ${getVerdict(summary.stages).padEnd(20)} stages=[${[...summary.stages].join(', ')}] ` +
        `keysExamined=${summary.keysExamined} docsExamined=${summary.docsExamined} returned=${summary.returned}`,
    );
  }
};

explainRestaurantQueries()
  .catch(error => {
    logger.error(`Explain failed: ${error.stack}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectFromDatabase());
