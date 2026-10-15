# Microlink Search verification (2026-10-14)

## Current free-plan decision

Microlink's current official pages say every API key includes 100 free requests/month, Search included, with no credit card. This permits a live Google Autocomplete integration test on a free account. Older indexed Microlink pages/snippets that describe Search as paid-only or free-plan-excluded conflict with the current first-party product and API pages and must not be relied upon.

Live commands (`npm run test:integration`, `npm run test:live`, and `npm run discover:alphabet`) load the root `.env` using Node's built-in `--env-file=.env` support (Node 24.12.0). The ordinary `npm test` suite deliberately remains offline and does not load `.env`. The file is not read, printed, or committed by the application.

## Manual live Autocomplete command

Run the existing provider adapter against the fixed seed `chipotle menu`:

```powershell
npm run test:live
```

The default country is `us`. Supply a two-letter ISO 3166-1 country code when needed:

```powershell
npm run test:live -- --country ca
```

The command loads the root `.env` with Node's `--env-file=.env` option, prints only the provider-returned suggestions, and exits non-zero if the request fails or no valid suggestions are returned. It never prints `MICROLINK_API_KEY`.

Do not enable recursive expansion. The implementation is limited to one `autocomplete` call per cache miss.

## Phase 1: A-Z expansion

`createAlphabetExpansionEngine` generates all 26 one-level suffix patterns for a seed (`seed a` through `seed z`) and sends only the scheduled patterns through the existing provider adapter. Its default run budget is 25 requests, so the final pattern remains unrequested unless the caller explicitly raises the engine budget to 26. The provider's own budget remains an additional hard safeguard.

Run the live progress reporter (uses the fixed `chipotle menu` seed):

```powershell
npm run discover:alphabet
npm run discover:alphabet -- --country ca --max-requests 25
```

It displays generated query-pattern progress separately from actual provider-returned suggestions, records the source expansion query and discovery depth 1, retains successful results when individual requests fail, and does not enqueue discovered suggestions for recursive work.

## Verified integration surface

- Use the official `microlink.io` server SDK: `createClient({ apiKey: process.env.MICROLINK_API_KEY })`, then `microlink.search(seed, { type: 'autocomplete', location })`.
- The SDK sends the key as the `x-api-key` request header. Keep `MICROLINK_API_KEY` only in the server environment.
- The installed official SDK (microlink.io 1.0.2) builds `https://microlink.google/{query}/{limit?}/{location?}?type=autocomplete` and submits it through the authenticated Microlink API endpoint (`pro.microlink.io`). Use the SDK rather than hard-coding either URL, so endpoint mechanics remain provider-owned and upgradeable.
- `type: 'autocomplete'` returns `page.results`, whose suggestion entries use `value`.
- `location` is a two-letter ISO 3166-1 country code. The keyword-research documentation states that no language option is available; country influences localization/language. The adapter accepts `language` for its provider contract but marks it `languageApplied: false` and does not send it.
- The default `search` type, not autocomplete, is documented to expose `relatedSearches` (`query`) and `peopleAlsoAsk` (`question`, `snippet`, `title`, `link`) when Google displays them. They are intentionally not implemented or tested yet.

## Guardrails in the initial adapter

- Provider adapter contract allows replacement without changing callers.
- Process-local cache avoids repeat calls for identical seed/country/language input.
- `getUsage()` reports outbound cache-miss calls; `KEYWORD_DISCOVERY_MAX_REQUESTS` stops calls at a hard budget.
- 429/rate-limit errors set a cooldown and surface a typed error with an optional retry delay.
- Provider failure never produces fallback or synthetic suggestions.
- Identical concurrent calls are coalesced in an in-flight map, so only the first call consumes a local budget slot. A different concurrent cache miss sees the incremented counter and cannot exceed the configured per-provider-instance budget.

## Observed verification results

- `npm test` completed successfully as an offline suite: 9 passed; 0 failed; 0 skipped. It includes the provider and A-Z discovery-engine tests, but no live request.
- `npm run test:integration` completed successfully as the separate live suite: 1 passed; 0 failed; 0 skipped for the real `chipotle menu` Autocomplete request.
- The installed official Microlink SDK was initialized through the provider factory without making a network request; its `autocomplete` adapter method was present.
- The offline provider tests observed the documented call shape exactly: `search('chipotle menu', { type: 'autocomplete', location: 'us' })`. The mocked documented response shape `{ results: [{ value: '...' }] }` was normalized to sourced suggestions without changing the values.
- Offline tests observed a repeat cache hit made no extra provider call, and two concurrent identical calls made one provider call. A concurrent distinct request was rejected when its single-request budget was already reserved.
- Offline tests observed an HTTP 429 / `retry-after: 2` response becoming `RATE_LIMITED` with a 2,000 ms cooldown; a second request in that cooldown made no provider call.
- The live `chipotle menu` test received a provider response, normalized its `results[].value` entries into non-empty sourced suggestions, and passed without printing any suggestions or credentials. This verifies the current extraction path against a real response.
- The provider reads the key only from `process.env` in the server-side provider factory; the test runner loads the local root `.env` before tests run. `.env` is listed in `.gitignore`, and `.env.example` now contains placeholders only. Git metadata is unavailable in this workspace, so `git check-ignore` could not be run; the ignore-rule file itself was inspected.

## Remaining risks and next step

- The cache, in-flight map, counter, and budget are process-local. They are hard within one server process, but would need a shared store/atomic limiter before running multiple server instances.
- Google's displayed autocomplete set can vary by country and over time. It is a suggestion source, not a complete inventory of all Google-related queries or a source of volume, CPC, or difficulty.
- Exact next step: preserve this verified provider and begin Phase 1 A-Z expansion only through the adapter, with its own queue, request-budget, and deduplication tests.

## Sources

- [Microlink Search product page](https://microlink.io/search) — 100 free searches/month, SDK initialization, supported surfaces.
- [Microlink Search SDK documentation](https://github.com/microlinkhq/microlink) — `search`, `autocomplete`, `location`, key header, and response fields.
- [Keyword-research use case](https://microlink.io/use-cases/search-api/keyword-research) — autocomplete response, location and documented related/PAA shapes.
- [Microlink API plan FAQ](https://microlink.io/api) — 100 free requests/month, Search included, auth and rate-limit response headers.
