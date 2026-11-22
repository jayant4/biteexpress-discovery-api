# Design notes

Decisions, alternatives considered and trade-offs for the BiteExpress restaurant-discovery MVP.

## Goals this design serves

- **Now (6–12 months): reliability and performance at peak.** Every query is index-backed and bounded (page cap, timeout, projection).
- **Later (2–3 years): cloud-native, international, regulated.** The service is stateless and env-configured; MongoDB Atlas is a connection-string change, and the schema carries `country`, `currency` and source IDs.

## Architecture

```
route -> validation middleware -> controller -> service -> Mongoose model -> MongoDB
```

| Layer          | Responsibility                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `routes/`      | URL + method, request validation with class-validator DTOs                                     |
| `controllers/` | Read the validated request, call the service, choose the status code, send `{ data, message }` |
| `services/`    | Business rules (cross-field checks, merging parsed and explicit filters, paging) and queries   |
| `models/`      | Mongoose schema, indexes and collation                                                         |
| `adapters/`    | Pluggable query parser and distance ranker                                                     |

Services throw `HttpException(status, message)`; one error middleware turns it into the response. 4xx are logged as warnings, 5xx as errors with the stack, and unexpected errors never leak their message to the caller.

The validation middleware writes the transformed DTO back onto the request, so controllers receive typed, defaulted values (`page=1`, `limit=20`, numbers instead of strings) and unknown query parameters are rejected with a 400.

_Trade-off:_ the service talks to the Mongoose model directly instead of going through a repository class. That matches the house style of the codebase this follows and keeps the file count low. Unit tests stay database-free by spying on the service's own query methods (`findRestaurants`, `getCitiesAndCuisines`).

## Data model

One `restaurants` collection, one document per restaurant, with everything discovery reads embedded (address, GeoJSON `location`, `cuisines` array, `rating`, `flags`).

- **Embedded, not normalised:** discovery always reads a restaurant as a unit. One document is one read, with no joins on the hot path.
- **`cuisines` as an array:** a multikey index answers "serves X" directly.
- **`location` as GeoJSON `[lng, lat]`:** required by the 2dsphere index. It is omitted when the source has 0,0 or invalid coordinates, so those rows are listable but never appear in distance queries.
- **`_id` is an ObjectId; Zomato's ID is `externalId`** (unique partial index). Restaurants created through the API have no Zomato ID, and keeping the legacy key supports coexistence with, and CDC from, the existing relational system.
- **Unrated (`0` / "Not rated") is stored as `null`**, so it doesn't count as zero stars.
- **Collection default collation `{ locale: "en", strength: 2 }`:** case-insensitive equality on `city` that still uses the index.

Alternatives: Zomato ID as `_id` (needs invented IDs for API-created rows); normalised city/cuisine collections (`$lookup` on the hot path).

## Indexes

| Index                                             | Serves                                                         |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `{ location: "2dsphere" }`                        | `$geoNear` distance queries                                    |
| `{ city: 1, "rating.aggregate": -1, _id: 1 }`     | best-rated in a city (ESR; `_id` matches the tie-breaker sort) |
| `{ cuisines: 1, "rating.aggregate": -1, _id: 1 }` | best-rated for a cuisine (multikey)                            |
| `{ externalId: 1 }` unique, partial               | idempotent seeding; legacy lookups                             |

`src/scripts/explainRestaurantQueries.ts` checks the main query shapes. The first version of the compound indexes lacked `_id`, and explain showed an in-memory `SORT`; adding `_id` removed it.

Known limits: name search is a case-insensitive regex, which can't use an index efficiently (fine at ~10k documents; Atlas Search at scale). With a plain 2dsphere index, `$geoNear` finds nearby candidates and then checks the other filters per candidate; a compound 2dsphere index (e.g. `{ location, cuisines }`) is the upgrade if needed.

## One query path for list and search

`GET /v1/restaurants/search` must do everything `GET /v1/restaurants` does. Search turns the sentence into the same `Filters` object and calls the same `RestaurantService.listRestaurants`, so this holds by construction. A test asserts that both endpoints return identical items for the same parameters.

`$geoNear` must be the first pipeline stage, so with coordinates the other filters go into its `query`; without coordinates the first stage is `$match`. Atlas Search's `$search` also has to be the first stage, which is one reason it isn't combined with distance sorting here.

## Natural-language search

A rule-based parser (`utils/parseSearchQuery.ts`) extracts:

- city, including aliases such as Gurugram → Gurgaon
- cuisines, longest match first, whole words only
- price ("under Rs. 1000")
- ranking intent ("best", "nearest")
- dishes, mapped to a cuisine (vada pav → Street Food) and also matched against names and cuisines

If nothing is recognised, the text is treated as a restaurant name. The parser's vocabulary comes from `distinct` on the data and is cached for 60 seconds. Explicit query parameters override parsed values. The response includes `interpreted` so callers can see what was understood.

| Option                  | Why not (for the MVP)                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Rules (chosen)**      | Deterministic, testable, ~0 ms, no API key, can't fail a demo                                                        |
| LLM producing `Filters` | Cost, latency, non-determinism. A drop-in later: same output type, validated by the same DTO, with rules as fallback |
| Vector search           | Needs embeddings and Atlas; still needs structured filters for price, city and distance                              |
| Atlas Search            | Atlas-only; doesn't turn "under Rs 1000" into a number                                                               |

### Pluggable adapters (strategy + factory)

Two parts are swappable without touching `RestaurantService`, which depends only on their interfaces:

- **`IQueryParser`** (`NL_PARSER`, default `rules`) turns a sentence into filters. An LLM or Dialogflow provider is one new class plus one factory case. Every provider's output is validated against one class-validator DTO (`ParsedRestaurantFiltersDto`): unknown keys are stripped, `page`/`limit` can't be set, and invalid output is a 502, because a remote NLU is untrusted input.
- **`IDistanceRanker`** (`DISTANCE_RANKER`, default `straight-line`) decides "nearest". `$geoNear` always produces the candidates (index, filtering, excluding docs without a location). A ranker that re-orders them, such as road ETA, receives the 50 nearest as one window and the service pages inside it, so page 2 never holds a closer place than page 1. The ceiling is that you can't page past that window.
- **`IGeocoder`** (`GEOCODER`, default `locality`) turns a place name ("near Connaught Place", or `?place=`) into coordinates, which then feed the same `$geoNear` path. The default uses the data already in the collection: the average location of restaurants whose `locality` matches (case-insensitive through the collection collation, backed by the `locality` index). It needs no API key and can't fail live, but only knows localities that have restaurants. Google Maps or Mapbox would be one new class plus one factory case. Explicit `lat`/`lng` always win, and an unknown place is a 404 rather than silently ignored. A resolved place gets a 5 km radius unless one is given; without it, "best … near X" ranked the whole country by rating (see `docs/BUG-place-search-radius.md`).

The factories run at start-up, so a misspelt provider name stops the app before it takes traffic.

## Reliability guardrails

- Page size capped at 50.
- `maxTimeMS` of 2 s on every list or search query.
- Projection to only the response fields.
- `hasMore` from fetching `limit + 1` rows, with no count query.
- `_id` tie-breaker for stable paging.
- One connection pool per process.
- `/healthz` pings MongoDB.
- Graceful shutdown on SIGTERM.

## Testing

| Level       | What                                                                                                  | Database                                        |
| ----------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Unit        | pipeline builder, search parser, CSV conversion, service rules, parser and ranker adapters            | none (service query methods are spied on)       |
| Integration | all endpoints over HTTP with Supertest, 6 fixtures placed so every filter and sort has a known answer | real `mongod` 8.2.6 via `mongodb-memory-server` |

Mocking the database was rejected for the integration level because the logic that matters (`$geoNear`, collation, multikey indexes) runs inside MongoDB. Search gets the deepest coverage because it is the endpoint with the most moving parts: parsing, merging with explicit parameters, and the shared list path.

## Deliberately not built

Auth, update/delete, caching, multi-tenancy (`tenantId` leading every index), Atlas Search, an LLM/Dialogflow parser or road-ETA ranker (the interfaces and factories exist; no extra provider is implemented), keyset pagination, load tests. Each is named here rather than half-built.

## Path to production

- **Database and secrets:** Atlas, with secrets from a secret manager.
- **Runtime:** a rolling deploy of the stateless container, with readiness on `/healthz`. Seeding runs as a one-off job.
- **Read scaling:** discovery tolerates seconds of staleness, so it can read from secondaries, with short-TTL caching of hot queries.
- **International data:** Global Clusters (zone sharding) for user and order data residency. Restaurant data is public.
- **Migration from the monolith:** CDC upserting by `externalId`, cutting over per city behind a flag.

## Prices across currencies

The dataset covers 15 countries and 14 currencies, so `costForTwo` alone can't be compared or sorted. Each restaurant also stores `costForTwoInr`, converted when it is written (seed or `POST`), and `maxCostForTwo` and `sort=cost` use that field. Conversion happens at write time, never inside a query, so the filter stays a plain range on a stored number.

- The currency comes from the **country code** (`currencyByCountryCode` in `utils/currency.ts`), not from the CSV's `Currency` column: that label says "Dollar($)" for four different currencies and "Botswana Pula(P)" for the Philippines. `currency` is stored as an ISO code (`INR`, `USD`, …).
- The rates in `approximateInrPerCurrencyUnit` are fixed approximations. Production would load daily rates into a `currencies` collection and recompute `costForTwoInr` when they change (a scheduled `updateMany` per currency).
- `POST` accepts `currency` from the supported list (default `INR`); an unknown currency is a 400 rather than a restaurant that can never match a price filter.
- `maxCostForTwo` is a budget in INR. A `currency` parameter for budgets in other currencies is a small follow-up.
