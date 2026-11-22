# Bug: "best … near <place>" returned restaurants hundreds of km away

**Status:** fixed · **Severity:** high (wrong results with a 200, no error) · **Area:** `GET /v1/restaurants/search`, `GET /v1/restaurants?place=`

## Symptom

```
GET /v1/restaurants/search?q=best south indian near connaught place under Rs. 1000&limit=2
```

| #   | Restaurant                    | City       | Rating | Distance        |
| --- | ----------------------------- | ---------- | ------ | --------------- |
| 1   | Valarmathi Kongunaatu Samayal | Coimbatore | 4.5    | **1,962.75 km** |
| 2   | 22nd Parallel                 | Vadodara   | 4.5    | **813.16 km**   |

The user asked for places near Connaught Place, New Delhi. The response was a 200 with valid-looking data, so nothing flagged it.

## How it was found

Walking one request through every layer while documenting the search endpoint, then running it against the full dataset (9,551 restaurants). `interpreted` in the response showed the place had been resolved to coordinates correctly, so the problem was further down.

## Root cause

1. The parser read "best" as `sort: '-rating'` and "near connaught place" as `place: 'connaught place'`.
2. `resolvePlace` turned the place into `lat`/`lng`, **but set no radius**.
3. With a location, the pipeline's first stage is `$geoNear`. Without `maxDistance`, `$geoNear` does not limit the area: it only calculates a distance for every matching restaurant in the collection.
4. The `$sort` on rating then ranked all of India by rating, and the highest-rated South Indian restaurant anywhere won.

For a plain "near X" search the bug was hidden, because the default sort with a location is distance, so the nearest results still came first. It only showed up when the sentence also asked for a different order ("best", "cheapest").

## Why the tests missed it

Every place test either sorted by distance or passed `maxDistanceKm` explicitly. No fixture combined "near a place" with a higher-rated restaurant far away, so the wrong order never had a chance to show.

## Fix

When a place name is resolved to coordinates and the request has no radius, apply a default radius of **5 km** (`DEFAULT_PLACE_RADIUS_KM`, a typical food-delivery radius).

```ts
return { ...filters, lat: coordinates.lat, lng: coordinates.lng, maxDistanceKm: filters.maxDistanceKm ?? DEFAULT_PLACE_RADIUS_KM };
```

- An explicit `maxDistanceKm` still wins.
- Explicit `lat`/`lng` without a radius are unchanged: the caller chose a point, not a neighbourhood.
- The applied radius appears in `interpreted`, so a client can see why results stop at 5 km.

## Tests added (written first, failing before the fix)

| Test                                                                                   | Before the fix                                 | After  |
| -------------------------------------------------------------------------------------- | ---------------------------------------------- | ------ |
| "best restaurants near sector 29" returns only the two Gurgaon restaurants within 5 km | returned a Delhi and a Mumbai restaurant first | passes |
| service applies 5 km by default and keeps an explicit 12 km                            | `maxDistanceKm` missing                        | passes |
| an explicit `maxDistanceKm=50` beats the default                                       | passes (guard)                                 | passes |
| explicit coordinates without a radius stay unbounded                                   | passes (guard)                                 | passes |

Full suite: 145 passing.

## Verified on the full dataset

Same request after the fix:

| #   | Restaurant      | City      | Rating | Distance |
| --- | --------------- | --------- | ------ | -------- |
| 1   | Saravana Bhavan | New Delhi | 4.3    | 0.42 km  |
| 2   | Andhra Bhavan   | New Delhi | 4.2    | 1.74 km  |

## Follow-ups

- If nothing is found within 5 km, the result is an empty list. A friendlier option is to widen the radius in steps (5 → 10 → 20 km) and report the radius used.
- 5 km is a constant. If BiteExpress's delivery radius differs by city, it belongs on a city or locality record.
- Similar issue class: price filters compare amounts across currencies (`maxCostForTwo` has no currency), tracked separately.
