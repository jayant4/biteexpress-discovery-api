# Bug: the price filter compared amounts in different currencies

**Status:** fixed · **Severity:** high (wrong results with a 200, no error) · **Area:** `maxCostForTwo` and `sort=cost` on list and search

## Symptom

"under Rs. 1000" (`maxCostForTwo=1000`) without a city returned, besides Indian restaurants:

| Country            | Restaurants returned | Most expensive           |
| ------------------ | -------------------- | ------------------------ |
| United States      | 482                  | **$500** (about ₹42,500) |
| United Kingdom     | 80                   | **£230**                 |
| UAE                | 60                   | **AED 500**              |
| … 7 more countries |                      |                          |

None of those are under ₹1000. Indonesian restaurants never matched any budget, because their prices are in rupiah (70,000 to 800,000). `sort=cost` had the same problem: a $50 meal sorted as cheaper than a ₹100 one.

## How it was found

Reviewing the data model against the brief's goal of expanding to other countries, then grouping the "under 1000" results by currency on the full dataset.

## Root cause

`costForTwo` is stored in each restaurant's own currency, and the filter compared it as a plain number: `{ costForTwo: { $lte: 1000 } }`. The number 500 meant ₹500 for an Indian restaurant and $500 for an American one.

A second problem surfaced while fixing it: the CSV's `Currency` column can't be used to convert. It says "Dollar($)" for the US, Australia, Canada and Singapore, and "Botswana Pula(P)" for the Philippines, whose prices are Philippine pesos.

## Why the tests missed it

Every fixture was an Indian restaurant priced in rupees, so the comparison was always rupees against rupees.

## Fix

- Each restaurant stores **`costForTwoInr`**, converted **when it is written** (seed and `POST`), and `maxCostForTwo` and `sort=cost` use it.
- The currency is derived from the **country code** and stored as an ISO code (`INR`, `USD`, …), replacing the unreliable label.
- `POST /v1/restaurants` accepts `currency` from the supported list, defaulting to `INR`. An unknown currency is a 400.
- An unknown country leaves `currency` and `costForTwoInr` out, so the restaurant is excluded from price filters instead of matching with a wrong price.

Converting at write time keeps the query a plain range on a stored number; converting inside every query would cost more and complicate the filter.

## Tests added (written first, failing before the fix)

| Test                                                                                        | Before the fix                 | After  |
| ------------------------------------------------------------------------------------------- | ------------------------------ | ------ |
| A $50 New York fixture is not "under ₹400", but is under ₹5,000                             | it was "under 400"             | passes |
| `sort=cost` puts the ₹100 restaurant first and the $50 one last                             | the $50 one sorted as cheapest | passes |
| CSV rows: currency from the country code; the Philippines' "Botswana Pula(P)" becomes `PHP` | label copied as-is             | passes |
| Unknown country → no currency, no rupee price                                               | n/a                            | passes |
| `toInr` conversion, rounding and unknown currency                                           | module didn't exist            | passes |
| `POST` stores `costForTwoInr`, converts `USD`, rejects `Dollar($)`                          | no conversion                  | passes |
| The pipeline filters and sorts on `costForTwoInr`                                           | used `costForTwo`              | passes |

Full suite: 156 passing.

## Verified on the full dataset

After re-seeding, "under ₹1000" by currency:

| Currency | Restaurants | Most expensive (local) | In INR |
| -------- | ----------- | ---------------------- | ------ |
| INR      | 7,530       | ₹1,000                 | 1,000  |
| USD      | 136         | $10                    | 850    |
| TRY      | 34          | 400 TL                 | 880    |
| IDR      | 6           | 165,000 Rp             | 858    |

US results dropped from 482 (up to $500) to 136 (up to $10), and Indonesia appears for the first time. All 9,551 restaurants have `costForTwoInr`.

## Follow-ups

- The rates are fixed approximations. Production: daily rates in a `currencies` collection, with `costForTwoInr` recomputed when they change.
- A `currency` query parameter so a budget can be given in another currency ("under $20").
- 18 restaurants have a cost of 0, which is probably missing data rather than free food. They currently match every budget.
