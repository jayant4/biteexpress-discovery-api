# BiteExpress Restaurant Discovery API

An MVP of restaurant discovery for BiteExpress, built on **MongoDB**. Proof of concept and proof of value for moving the customer-facing discovery features off the relational monolith.

- `POST /v1/restaurants`: create a restaurant
- `GET /v1/restaurants/:id`: full details
- `GET /v1/restaurants`: list with filters (name, city, country, cuisines, rating, cost, distance) and sorting
- `GET /v1/restaurants/search`: everything the list does, plus natural-language queries (`q=best South Indian in Gurgaon`)
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
# The three example queries from the brief
curl "localhost:8000/v1/restaurants/search?q=Best%20restaurants%20in%20Gurgaon%20with%20South%20Indian%20Food"
curl "localhost:8000/v1/restaurants/search?q=Restaurants%20in%20Gurgaon%20under%20Rs.%201000%20for%20two"
curl "localhost:8000/v1/restaurants/search?q=Nearest%20place%20that%20serves%20Vada%20Pav&lat=19.07&lng=72.87"

# Structured filters, distance and sorting
curl "localhost:8000/v1/restaurants?city=gurgaon&cuisines=South%20Indian,Chinese&sort=-rating&limit=5"
curl "localhost:8000/v1/restaurants?lat=28.4595&lng=77.0266&maxDistanceKm=5"
curl "localhost:8000/v1/restaurants/search?q=south%20indian%20near%20connaught%20place"

# Create, then fetch
curl -X POST localhost:8000/v1/restaurants -H 'content-type: application/json' \
  -d '{"name":"Idli House","address":"Sector 14","city":"Gurgaon","country":"India","cuisines":["South Indian"],"lat":28.47,"lng":77.03,"costForTwo":300}'
curl localhost:8000/v1/restaurants/<id-from-above>
```

Every response is `{ "data": ..., "message": "..." }`; errors are `{ "message": "..." }`. Search responses include `data.interpreted`, which shows exactly which filters the sentence was turned into. Explicit query parameters override parsed ones.

### List and search parameters

| Param             | Example                                                                 | Notes                                                                      |
| ----------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `name`            | `wok`                                                                   | partial, case-insensitive                                                  |
| `city`            | `gurgaon`                                                               | case-insensitive exact match                                               |
| `country`         | `India`                                                                 | market scope; send the user's country so budget searches stay local        |
| `cuisines`        | `Chinese,North Indian`                                                  | matches any                                                                |
| `minRating`       | `4`                                                                     | 0–5                                                                        |
| `maxCostForTwo`   | `1000`                                                                  | in INR; each restaurant's price is converted to INR before comparing       |
| `lat`, `lng`      | `28.46`, `77.02`                                                        | both or neither; adds `distanceKm` and sorts nearest first                 |
| `maxDistanceKm`   | `5`                                                                     | needs `lat`/`lng`                                                          |
| `place`           | `Connaught Place`                                                       | a locality turned into `lat`/`lng`, 5 km radius by default; 404 if unknown |
| `sort`            | `relevance` `distance` `rating` `-rating` `name` `-name` `cost` `-cost` | `-` = descending                                                           |
| `page`, `limit`   | `1`, `20`                                                               | `limit` is capped at 50; the response has `hasMore`                        |
| `q` (search only) | `cheap chinese in gurugram`                                             | max 200 characters                                                         |

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

The search endpoint has the most coverage: the three queries from the brief, combined phrases (city + cuisine + budget + ranking), dishes, aliases, explicit parameters overriding the sentence, radius and "nearest" rules, paging, the `interpreted` field, bad input, and a check that search returns exactly what list returns for the same parameters.

## Configuration

Read from the environment, or from `.env.<NODE_ENV>.local` if present.

| Variable                 | Default                                 | Purpose                                                                 |
| ------------------------ | --------------------------------------- | ----------------------------------------------------------------------- |
| `MONGODB_CONNECTION_URL` | `mongodb://localhost:27018/biteexpress` | MongoDB connection string, including the database (Atlas works as is)   |
| `PORT`                   | `8000`                                  | HTTP port                                                               |
| `MONGO_QUERY_TIMEOUT_MS` | `2000`                                  | `maxTimeMS` on list and search queries                                  |
| `NL_PARSER`              | `rules`                                 | Natural-language parser. Unknown values stop start-up.                  |
| `DISTANCE_RANKER`        | `straight-line`                         | How "nearest" is ranked after `$geoNear`. Unknown values stop start-up. |
| `GEOCODER`               | `locality`                              | How `place` becomes coordinates. Unknown values stop start-up.          |
| `CSV_FILE_PATH`          | `data/zomato.csv`                       | Seed input                                                              |
| `SAMPLE_CSV_FILE_PATH`   | `data/sample.csv`                       | Seed fallback when the full file is missing                             |

Adding a provider (an LLM or Dialogflow parser, a road-ETA ranker) is one class plus one `case` in its factory in `src/adapters/`.

## Project structure

```
src/
  routes/        URL + validation middleware -> controller
  controllers/   read the request, call the service, send { data, message }
  services/      business rules and all database access (Mongoose model)
  adapters/      pluggable query parser and distance ranker, with factories
  dtos/          class-validator request classes
  models/        Mongoose schema, indexes, collation
  interfaces/    TypeScript types and shared constants
  middlewares/   validation and error handling
  exceptions/    HttpException
  utils/         pipeline builder, search parser, CSV conversion, response formatting, logger
  scripts/       seedRestaurants.ts, explainRestaurantQueries.ts
  tests/         unit/, integration/, helpers/
  app.ts         Express app: middlewares, routes, Swagger, error handling
  server.ts      connect, create indexes, listen, graceful shutdown
swagger.yaml     OpenAPI description served at /api-docs
```

## Design

### Schema: embed vs reference

One `restaurants` collection. Everything discovery reads together is embedded in the restaurant document: address, GeoJSON `location`, `cuisines`, `rating`, `flags` and prices.

- **Why embed.** Discovery reads a restaurant as one unit, so one document is one indexed read with no `$lookup` on the hot path. It also has to be this way for distance queries: `$geoNear` must be the first pipeline stage, and its `query` can only filter fields in the same document. If cuisines lived in another collection, "nearest South Indian" would have to find the nearest restaurants of every cuisine, join, and throw most away, which also breaks paging.
- **Cuisines are a small, bounded array** (1 to 8 per restaurant), so they are embedded, and the multikey index `cuisines_rating_id` serves "best South Indian" directly. The cost is that renaming a cuisine means updating many documents, which is rare.
- **What I would reference instead,** as the product grows: reviews and orders (they grow without limit, and a document is capped at 16 MB), full menus (change often and are read on their own), and lookup data such as countries, cuisine synonyms and localities. Those belong in their own collections, with the few values needed for reads copied into the restaurant (the extended-reference pattern).

### More detail

See **[docs/DESIGN.md](docs/DESIGN.md)** for the indexes, the shared list/search query path, the natural-language approach, trade-offs, what was deliberately left out, and the path to production.

Bugs found and fixed, each with root cause, failing tests written first, and the fix:

- **[docs/BUG-place-search-radius.md](docs/BUG-place-search-radius.md):** "best ... near <place>" returned restaurants hundreds of kilometres away.
- **[docs/BUG-price-filter-currency.md](docs/BUG-price-filter-currency.md):** the price filter and cost sort compared amounts in different currencies; fixed by storing a rupee price at write time.
- **Monkey test** (random and hostile `/search` inputs): a null byte or a huge `page` caused 500s, "within 0 km" caused a 502, and "under 1e9" became a ₹1 budget. Fixed in the last two commits.

## AI and tools disclosure

<!-- REVIEW AND EDIT BEFORE SUBMITTING. This section must be accurate. -->

I used **Claude Code** (Anthropic's AI coding agent) throughout this project, as a pair programmer and for research.

- **Generated by Claude Code:** the project scaffold, the seed script, the create, get and list endpoints, the Docker setup, the tests and most of the documentation.
- **The restaurant model** (`src/models/restaurant.model.ts`): I researched the schema design with Claude Code and worked through the MongoDB documentation on data modelling, GeoJSON and `2dsphere` indexes, compound indexes and collation, then typed the model myself from a reference version Claude Code produced, checking each field, index and option against the documentation.
- **The search endpoint** (`GET /v1/restaurants/search`): Claude Code produced a reference implementation. I rebuilt it myself in seven reviewable commits (parser, strategy, service, route, docs, then two rounds of fixes), running the type check and tests at each step, so that I understand and can change every part of it.
<!-- After writing your own change without AI-generated code, add:
- **Written by me without AI-generated code:** <the change>, with its tests.
-->

- **Testing and bugs:** I tested the API by hand with Bruno and found that "under Rs. 1000" returned US restaurants, which led to the `country` filter. Claude Code found the place-radius and mixed-currency bugs while tracing the code, and ran the monkey test I asked for. I reviewed each finding and the test-first fixes.
- **Design decisions** (single embedded collection, rule-based parser behind a swappable strategy, what to leave out) were made in discussion with Claude Code; I can explain the reasoning and the alternatives for each.

Other resources: MongoDB documentation (data modelling, `$geoNear`, indexes, collation, `explain`), Express, Mongoose and class-validator documentation, and the Kaggle Zomato dataset.
