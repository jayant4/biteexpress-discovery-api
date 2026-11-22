import { CSV_FILE_PATH, SAMPLE_CSV_FILE_PATH } from '@config';
import { connectToDatabase, disconnectFromDatabase } from '@databases';
import RestaurantService from '@services/restaurant.service';
import { csvRowToRestaurant } from '@utils/csvRowToRestaurant';
import { logger } from '@utils/logger';
import { parse } from 'csv-parse/sync';
import { existsSync, readFileSync } from 'fs';

const BATCH_SIZE = 1000;

const getCsvFilePath = (): string => {
  if (existsSync(CSV_FILE_PATH)) return CSV_FILE_PATH;
  if (!existsSync(SAMPLE_CSV_FILE_PATH)) {
    throw new Error(`Neither ${CSV_FILE_PATH} nor ${SAMPLE_CSV_FILE_PATH} exists. Download the Zomato dataset into data/zomato.csv`);
  }
  logger.warn(`${CSV_FILE_PATH} not found, loading the sample data from ${SAMPLE_CSV_FILE_PATH}`);
  return SAMPLE_CSV_FILE_PATH;
};

const seedRestaurants = async () => {
  const csvFilePath = getCsvFilePath();
  const rows: Record<string, string>[] = parse(readFileSync(csvFilePath, 'latin1'), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  await connectToDatabase();
  const restaurantService = new RestaurantService();
  await restaurantService.ensureRestaurantIndexes();

  const restaurantList = rows.map(csvRowToRestaurant);
  const validRestaurants = restaurantList.filter(restaurant => restaurant.externalId !== undefined && restaurant.name);

  let writtenCount = 0;
  for (let index = 0; index < validRestaurants.length; index += BATCH_SIZE) {
    writtenCount += await restaurantService.upsertRestaurantsByExternalId(validRestaurants.slice(index, index + BATCH_SIZE));
  }

  const skippedCount = restaurantList.length - validRestaurants.length;
  const totalCount = await restaurantService.countRestaurants();
  logger.info(`Seed finished: ${rows.length} rows read, ${writtenCount} written, ${skippedCount} skipped, ${totalCount} in database`);
};

seedRestaurants()
  .catch(error => {
    logger.error(`Seed failed: ${error.stack}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectFromDatabase());
