# BiteExpress Restaurant Discovery API

An MVP of restaurant discovery for BiteExpress, built on **MongoDB**. Proof of concept and proof of value for moving the customer-facing discovery features off the relational monolith.

- `POST /v1/restaurants`: create a restaurant
- `GET /v1/restaurants/:id`: full details
- `GET /v1/restaurants`: list with filters (name, city, country, cuisines, rating, cost, distance) and sorting
- `GET /healthz`: liveness plus a database ping. `GET /api-docs`: interactive OpenAPI (Swagger UI)

Stack: TypeScript, Node 22, Express 4, Mongoose 9, class-validator, MongoDB 8.2, Jest + Supertest, ESLint + Prettier, Docker Compose.

## Quick start

```bash
docker compose up --build
```

This starts MongoDB, loads the data, then starts the API on **http://localhost:8000**. Open http://localhost:8000/api-docs.

**Data:** a fresh clone loads a committed **10-row synthetic sample** (`data/sample.csv`), and the seed logs a warning saying so. For the full dataset, download the [Kaggle Zomato Restaurants dataset](https://www.kaggle.com/datasets/shrutimehta/zomato-restaurants-data) and place `zomato.csv` in `data/` before `docker compose up`. Re-running the seed is idempotent: it upserts by Zomato ID.

MongoDB is published on **localhost:27018**, not 27017, so it doesn't clash with a local MongoDB (for example in Compass: `mongodb://localhost:27018`).

## Try it

```bash
# Structured filters, distance and sorting
curl "localhost:8000/v1/restaurants?city=gurgaon&cuisines=South%20Indian,Chinese&sort=-rating&limit=5"
curl "localhost:8000/v1/restaurants?lat=28.4595&lng=77.0266&maxDistanceKm=5"
curl "localhost:8000/v1/restaurants?place=Connaught%20Place&cuisines=South%20Indian"

# Create, then fetch
curl -X POST localhost:8000/v1/restaurants -H 'content-type: application/json' \
  -d '{"name":"Idli House","address":"Sector 14","city":"Gurgaon","country":"India","cuisines":["South Indian"],"lat":28.47,"lng":77.03,"costForTwo":300}'
curl localhost:8000/v1/restaurants/<id-from-above>
```

Every response is `{ "data": ..., "message": "..." }`; errors are `{ "message": "..." }`.

### List parameters

| Param           | Example                                                                 | Notes                                                                      |
| --------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `name`          | `wok`                                                                   | partial, case-insensitive                                                  |
| `city`          | `gurgaon`                                                               | case-insensitive exact match                                               |
| `country`       | `India`                                                                 | market scope; send the user's country so budget searches stay local        |
| `cuisines`      | `Chinese,North Indian`                                                  | matches any                                                                |
| `minRating`     | `4`                                                                     | 0–5                                                                        |
| `maxCostForTwo` | `1000`                                                                  | in INR; each restaurant's price is converted to INR before comparing       |
| `lat`, `lng`    | `28.46`, `77.02`                                                        | both or neither; adds `distanceKm` and sorts nearest first                 |
| `maxDistanceKm` | `5`                                                                     | needs `lat`/`lng`                                                          |
| `place`         | `Connaught Place`                                                       | a locality turned into `lat`/`lng`, 5 km radius by default; 404 if unknown |
| `sort`          | `relevance` `distance` `rating` `-rating` `name` `-name` `cost` `-cost` | `-` = descending                                                           |
| `page`, `limit` | `1`, `20`                                                               | `limit` is capped at 50; the response has `hasMore`                        |

## Development

```bash
npm ci
npm test                  # all tests; downloads a real mongod 8.2.6 on first run, no Docker needed
npm run test:unit         # pure functions and the service, no database
npm run test:integration  # HTTP requests through Express against a real MongoDB
npm run test:coverage
npm run lint
npm run typecheck
npm run dev               # needs MongoDB, e.g. the compose one on localhost:27018 (the default)
npm run seed              # load data/zomato.csv (or the sample) into the database
```

Check that the main queries use indexes:

```bash
docker compose exec api node dist/scripts/explainRestaurantQueries.js
```

## Testing

| Level       | Folder                  | What it covers                                                                                                                                                                               |
| ----------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `src/tests/unit`        | pipeline builder, natural-language parser, CSV conversion, service rules and the parser/ranker adapters (service methods are spied on, no database)                                          |
| Integration | `src/tests/integration` | every endpoint over HTTP with Supertest, against a real `mongod` from `mongodb-memory-server` and 6 fixture restaurants placed so every filter, sort and distance has one known right answer |

## Configuration

Read from the environment, or from `.env.<NODE_ENV>.local` if present.

| Variable                 | Default                                 | Purpose                                                                 |
| ------------------------ | --------------------------------------- | ----------------------------------------------------------------------- |
| `MONGODB_CONNECTION_URL` | `mongodb://localhost:27018/biteexpress` | MongoDB connection string, including the database (Atlas works as is)   |
| `PORT`                   | `8000`                                  | HTTP port                                                               |
| `MONGO_QUERY_TIMEOUT_MS` | `2000`                                  | `maxTimeMS` on list queries                                             |
| `DISTANCE_RANKER`        | `straight-line`                         | How "nearest" is ranked after `$geoNear`. Unknown values stop start-up. |
| `GEOCODER`               | `locality`                              | How `place` becomes coordinates. Unknown values stop start-up.          |
| `CSV_FILE_PATH`          | `data/zomato.csv`                       | Seed input                                                              |
| `SAMPLE_CSV_FILE_PATH`   | `data/sample.csv`                       | Seed fallback when the full file is missing                             |

Adding a provider (a road-ETA ranker, a maps geocoder) is one class plus one `case` in its factory in `src/adapters/`.

## Project structure

```
src/
  routes/        URL + validation middleware -> controller
  controllers/   read the request, call the service, send { data, message }
  services/      business rules and all database access (Mongoose model)
  adapters/      pluggable distance ranker and geocoder, with factories
  dtos/          class-validator request classes
  models/        Mongoose schema, indexes, collation
  interfaces/    TypeScript types and shared constants
  middlewares/   validation and error handling
  exceptions/    HttpException
  utils/         pipeline builder, CSV conversion, response formatting, logger
  scripts/       seedRestaurants.ts, explainRestaurantQueries.ts
  tests/         unit/, integration/, helpers/
  app.ts         Express app: middlewares, routes, Swagger, error handling
  server.ts      connect, create indexes, listen, graceful shutdown
swagger.yaml     OpenAPI description served at /api-docs
```

## AI and tools disclosure

<!-- REVIEW AND EDIT BEFORE SUBMITTING. This section must be accurate. -->

I used **Claude Code** (Anthropic's AI coding agent) on this project. It generated the project scaffold (data model, seed script, create/get/list endpoints, Docker setup, tests and this README) and the code for the natural-language search endpoint (`GET /v1/restaurants/search`), which is added in the commits after the scaffold.

_(My role, fill in honestly before submitting: for example, the design decisions I made, what I reviewed and changed, and that I can explain and modify every line.)_

Other resources: MongoDB documentation (`$geoNear`, indexes, collation, `explain`), Express, Mongoose and class-validator documentation, and the Kaggle Zomato dataset.
