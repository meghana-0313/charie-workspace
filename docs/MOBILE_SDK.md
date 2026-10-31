# Charie Mobile SDK contract (v1)

Native crash and error reporting for iOS and Android apps. The web SDK
(`apps/portal/public/charie.js`) is the reference implementation of this
contract; native wrappers (Swift/Kotlin) follow it exactly.

## Endpoint

`POST {portal}/api/guardian/events`

Headers: `content-type: application/json`, `x-charie-key: chp_<prefix>_<secret>`

Keys are minted on the Team page (App ingest keys). One key per app. Revoked
keys get 403. No session cookie needed, so this works from devices in the wild.

## Body

```json
{
  "events": [
    {
      "id": "sdk_abc123",
      "ts": "2026-10-31T20:00:00.000Z",
      "kind": "api",
      "actor": "shop-ios/2.4.1",
      "endpoint": "POST /checkout",
      "outcome": "failure"
    }
  ]
}
```

Rules: 1 to 500 events per batch. `kind` is one of `auth`, `api`, `traffic`,
`infra` (unknown values are coerced, never rejected). Missing `id`/`ts` are
filled in server side. Keep `endpoint` under 300 chars.

## Client behavior (what the SDK must do)

1. Capture: uncaught exceptions, fatal signals (native), failed network calls
   (5xx or transport error). Never capture request/response bodies, tokens, or
   free-form user input.
2. Batch: hold events up to 5 seconds or 20 events, whichever comes first.
3. Offline queue: persist unsent batches on disk (max ~100), retry with
   exponential backoff, drop oldest first.
4. Sampling: client errors 100%, transport blips max 1 per minute per endpoint.
5. Privacy: no device fingerprinting, no advertising IDs, no location. The only
   stored fields are the event shape above plus the app name on the key.

## What Charie does with mobile events

Batches land in the same pipeline as web SDK and log-watch events: detectors
flag spikes, Meta models investigate, incidents open on the Threats page, and
approved responses become fix tasks. Mobile regressions (a new app version that
starts crashing checkout) surface as log-style incidents with the version in
the actor field.

## Native roadmap

v1 (this doc): contract + web reference. Next: thin Swift Package and Kotlin
library implementing capture, batching, and offline queue against this exact
endpoint. No server changes needed.
