const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
const DEFAULT_MAX_REQUESTS = 25

const requireSeed = seed => {
  const value = seed?.trim()
  if (!value) throw new TypeError('seed must be a non-empty string.')
  return value
}

const requireBudget = maxRequests => {
  if (!Number.isInteger(maxRequests) || maxRequests < 0) {
    throw new TypeError('maxRequests must be a non-negative integer.')
  }
  return maxRequests
}

const report = (onProgress, event) => onProgress?.(event)

export function generateAlphabetExpansionQueries(seed) {
  const normalizedSeed = requireSeed(seed)
  return [...ALPHABET].map(letter => `${normalizedSeed} ${letter}`)
}

/**
 * One-level A-Z keyword discovery. It deliberately does not enqueue results,
 * so recursive expansion can be added as a separate future policy.
 */
export function createAlphabetExpansionEngine({
  provider,
  maxRequests = DEFAULT_MAX_REQUESTS,
  onProgress
} = {}) {
  if (!provider || typeof provider.autocomplete !== 'function') {
    throw new TypeError('provider.autocomplete must be a function.')
  }
  const requestBudget = requireBudget(maxRequests)

  return {
    async discover({ seed, country } = {}) {
      const originalSeed = requireSeed(seed)
      // A-Z is unique today, but preserve a request-level deduplication step
      // so future modifier generators cannot schedule duplicate provider calls.
      const plannedQueries = [...new Set(generateAlphabetExpansionQueries(originalSeed))]
      const scheduledQueries = plannedQueries.slice(0, requestBudget)
      const skippedExpansionQueries = plannedQueries.slice(scheduledQueries.length)
      const discoveries = []
      const errors = []
      const seenSuggestions = new Set()
      let completedRequests = 0
      let successfulRequests = 0
      let terminatedEarly = false

      report(onProgress, {
        type: 'start',
        originalSeed,
        country,
        plannedRequests: plannedQueries.length,
        scheduledRequests: scheduledQueries.length,
        requestBudget
      })

      for (const [index, expansionQuery] of scheduledQueries.entries()) {
        report(onProgress, {
          type: 'request-start',
          originalSeed,
          expansionQuery,
          country,
          completedRequests,
          totalRequests: scheduledQueries.length,
          requestNumber: index + 1
        })

        try {
          const response = await provider.autocomplete({ seed: expansionQuery, country })
          completedRequests += 1
          successfulRequests += 1
          let returnedSuggestions = 0

          for (const suggestion of response.suggestions || []) {
            if (typeof suggestion?.value !== 'string' || !suggestion.value.trim()) continue
            returnedSuggestions += 1
            const dedupeKey = suggestion.value.trim().toLowerCase()
            if (seenSuggestions.has(dedupeKey)) continue
            seenSuggestions.add(dedupeKey)
            discoveries.push({
              originalSeed,
              expansionQuery,
              country: response.country,
              source: suggestion.source || response.source,
              discoveryDepth: 1,
              phrase: suggestion.value
            })
          }

          report(onProgress, {
            type: 'request-complete',
            originalSeed,
            expansionQuery,
            country: response.country,
            completedRequests,
            totalRequests: scheduledQueries.length,
            requestNumber: index + 1,
            returnedSuggestions,
            uniqueSuggestions: discoveries.length,
            cached: response.cached === true
          })
        } catch (error) {
          completedRequests += 1
          const failure = {
            expansionQuery,
            country,
            code: error?.code || 'PROVIDER_REQUEST_FAILED',
            message: error?.message || 'Provider request failed.'
          }
          errors.push(failure)
          report(onProgress, {
            type: 'request-error',
            originalSeed,
            ...failure,
            completedRequests,
            totalRequests: scheduledQueries.length,
            requestNumber: index + 1,
            uniqueSuggestions: discoveries.length
          })

          // The adapter has a hard budget. Continuing after this typed error
          // can only create more failures, so leave the rest of the queue for
          // a later run while retaining already successful discoveries.
          if (failure.code === 'USAGE_BUDGET_EXHAUSTED') {
            skippedExpansionQueries.push(...scheduledQueries.slice(index + 1))
            terminatedEarly = true
            break
          }
        }
      }

      const summary = {
        originalSeed,
        country,
        requestBudget,
        plannedQueries,
        completedRequests,
        successfulRequests,
        errors,
        skippedExpansionQueries,
        terminatedEarly,
        uniqueSuggestions: discoveries.length,
        discoveries
      }
      report(onProgress, { type: 'complete', ...summary })
      return summary
    }
  }
}

export { DEFAULT_MAX_REQUESTS }
