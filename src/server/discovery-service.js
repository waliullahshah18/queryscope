import { z } from 'zod'
import { createAlphabetExpansionEngine } from '../keyword-discovery/alphabet-expansion-engine.js'
import { createMicrolinkAutocompleteProvider } from '../keyword-discovery/microlink-autocomplete-provider.js'

export const COUNTRIES = [
  { code: 'us', name: 'United States' }, { code: 'ca', name: 'Canada' },
  { code: 'gb', name: 'United Kingdom' }, { code: 'au', name: 'Australia' },
  { code: 'de', name: 'Germany' }, { code: 'fr', name: 'France' },
  { code: 'es', name: 'Spain' }, { code: 'it', name: 'Italy' },
  { code: 'br', name: 'Brazil' }, { code: 'mx', name: 'Mexico' },
  { code: 'in', name: 'India' }, { code: 'jp', name: 'Japan' }
]

const countryCodes = COUNTRIES.map(country => country.code)

export const discoverRequestSchema = z.object({
  seed: z.string().trim().min(1, 'Enter a seed keyword.').max(120, 'Seed keywords must be 120 characters or fewer.'),
  country: z.enum(countryCodes),
  language: z.string().trim().regex(/^[a-z]{2}$/i, 'Use a two-letter language code.').optional(),
  expansionType: z.literal('alphabet'),
  maxRequests: z.number().int().min(1).max(25)
}).strict()

let providerPromise

export const getServerAutocompleteProvider = () => {
  if (!providerPromise) providerPromise = createMicrolinkAutocompleteProvider()
  return providerPromise
}

const publicErrorMessage = code => {
  if (code === 'MISSING_API_KEY') return 'Keyword discovery is not configured on this server.'
  if (code === 'RATE_LIMITED') return 'The discovery provider is rate limited. Try again later.'
  if (code === 'USAGE_BUDGET_EXHAUSTED') return 'The server discovery budget is currently exhausted. Try again later.'
  return 'The discovery provider could not complete this request.'
}

const serializeSummary = summary => ({
  ...summary,
  errors: summary.errors.map(error => ({
    expansionQuery: error.expansionQuery,
    country: error.country,
    code: error.code,
    message: publicErrorMessage(error.code)
  }))
})

export async function handleDiscoverRequest(payload, { getProvider = getServerAutocompleteProvider } = {}) {
  const parsed = discoverRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return { status: 400, body: { error: 'Invalid discovery request.', fields: parsed.error.flatten().fieldErrors } }
  }

  const input = parsed.data
  try {
    const provider = await getProvider()
    const engine = createAlphabetExpansionEngine({ provider, maxRequests: input.maxRequests })
    const summary = await engine.discover({ seed: input.seed, country: input.country })
    return {
      status: 200,
      body: {
        seed: input.seed,
        country: input.country,
        language: input.language?.toLowerCase(),
        languageApplied: false,
        expansionType: input.expansionType,
        summary: serializeSummary(summary)
      }
    }
  } catch (error) {
    const code = error?.code || 'DISCOVERY_UNAVAILABLE'
    return { status: code === 'MISSING_API_KEY' ? 503 : 502, body: { error: publicErrorMessage(code), code } }
  }
}
