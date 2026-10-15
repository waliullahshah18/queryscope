import { KeywordDiscoveryError } from './provider.js'

const SOURCE = 'Google Autocomplete via Microlink Search'

const normalizeCountry = country => {
  const value = (country || 'us').trim().toLowerCase()
  if (!/^[a-z]{2}$/.test(value)) {
    throw new KeywordDiscoveryError('INVALID_COUNTRY', 'country must be an ISO 3166-1 alpha-2 code.')
  }
  return value
}

const normalizeSeed = seed => {
  const value = seed?.trim()
  if (!value) throw new KeywordDiscoveryError('INVALID_SEED', 'A non-empty seed keyword is required.')
  return value
}

const retryAfterMs = error => {
  const raw = error?.headers?.['retry-after'] || error?.response?.headers?.get?.('retry-after')
  const seconds = Number(raw)
  return Number.isFinite(seconds) ? seconds * 1000 : undefined
}

/**
 * Creates the initial server-side provider adapter. It deliberately uses the
 * documented SDK instead of relying on an undocumented HTTP Search URL.
 */
export async function createMicrolinkAutocompleteProvider({
  apiKey = process.env.MICROLINK_API_KEY,
  maxRequests = Number(process.env.KEYWORD_DISCOVERY_MAX_REQUESTS || 20),
  client,
  now = () => Date.now()
} = {}) {
  if (!apiKey) {
    throw new KeywordDiscoveryError('MISSING_API_KEY', 'MICROLINK_API_KEY must be configured on the server.')
  }
  if (!Number.isInteger(maxRequests) || maxRequests < 1) {
    throw new KeywordDiscoveryError('INVALID_BUDGET', 'maxRequests must be a positive integer.')
  }

  let microlink = client
  if (!microlink) {
    try {
      const module = await import('microlink.io')
      microlink = module.default({ apiKey })
    } catch (cause) {
      throw new KeywordDiscoveryError('MICROLINK_CLIENT_UNAVAILABLE', 'The microlink.io server dependency could not be loaded.', { cause })
    }
  }

  const cache = new Map()
  const inFlight = new Map()
  let requestCount = 0
  let rateLimitedUntil = 0

  return {
    source: SOURCE,
    getUsage: () => ({ requestCount, maxRequests, remaining: maxRequests - requestCount }),

    async autocomplete({ seed, country, language } = {}) {
      const query = normalizeSeed(seed)
      const location = normalizeCountry(country)
      const normalizedLanguage = language?.trim().toLowerCase() || undefined
      const cacheKey = JSON.stringify({ query, location, language: normalizedLanguage })
      const cached = cache.get(cacheKey)
      if (cached) return { ...cached, cached: true }

      const pending = inFlight.get(cacheKey)
      if (pending) {
        // Coalesce identical concurrent calls: the joining caller does not
        // cause another provider request and receives a cache-equivalent hit.
        return pending.then(result => ({ ...result, cached: true }))
      }

      const request = (async () => {
        if (now() < rateLimitedUntil) {
          throw new KeywordDiscoveryError('RATE_LIMITED', 'Microlink is rate limiting keyword discovery.', {
            retryAfterMs: rateLimitedUntil - now()
          })
        }
        if (requestCount >= maxRequests) {
          throw new KeywordDiscoveryError('USAGE_BUDGET_EXHAUSTED', 'Keyword discovery request budget is exhausted.')
        }

        requestCount += 1
        try {
          // Microlink documents country-level `location`; it documents no
          // language parameter for Autocomplete, so language is intentionally not sent.
          const page = await microlink.search(query, { type: 'autocomplete', location })
          const rawResults = Array.isArray(page?.results) ? page.results : []
          const suggestions = rawResults
            .map(result => result?.value)
            .filter(value => typeof value === 'string' && value.trim())
            .map(value => ({ value, source: SOURCE }))

          const result = {
            source: SOURCE,
            suggestions,
            country: location,
            language: normalizedLanguage,
            languageApplied: false,
            cached: false
          }
          cache.set(cacheKey, result)
          return result
        } catch (cause) {
          const status = cause?.statusCode || cause?.status
          if (status === 429 || /rate.?limit/i.test(cause?.code || '')) {
            const delay = retryAfterMs(cause) || 60_000
            rateLimitedUntil = now() + delay
            throw new KeywordDiscoveryError('RATE_LIMITED', 'Microlink is rate limiting keyword discovery.', { cause, retryAfterMs: delay })
          }
          // No synthetic or locally generated suggestions are ever returned.
          throw new KeywordDiscoveryError('PROVIDER_REQUEST_FAILED', 'Microlink Autocomplete request failed.', { cause })
        }
      })()

      inFlight.set(cacheKey, request)
      try {
        return await request
      } finally {
        if (inFlight.get(cacheKey) === request) inFlight.delete(cacheKey)
      }
    }
  }
}
