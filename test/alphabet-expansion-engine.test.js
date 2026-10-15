import test from 'node:test'
import assert from 'node:assert/strict'
import { createAlphabetExpansionEngine, generateAlphabetExpansionQueries } from '../src/keyword-discovery/alphabet-expansion-engine.js'

const response = (values, country = 'us') => ({
  source: 'Google Autocomplete via Microlink Search',
  country,
  suggestions: values.map(value => ({ value, source: 'Google Autocomplete via Microlink Search' }))
})

test('generates all 26 A-Z expansion query patterns', () => {
  const queries = generateAlphabetExpansionQueries('chipotle menu')
  assert.equal(queries.length, 26)
  assert.equal(queries[0], 'chipotle menu a')
  assert.equal(queries[25], 'chipotle menu z')
})

test('deduplicates suggestions case-insensitively while preserving the first returned phrase and metadata', async () => {
  const provider = {
    async autocomplete({ seed }) {
      if (seed.endsWith(' a')) return response(['Chipotle Menu Nutrition', 'Chipotle Menu Prices'])
      return response(['chipotle menu nutrition', 'CHIPOTLE MENU PRICES', 'Chipotle Menu Calories'])
    }
  }
  const engine = createAlphabetExpansionEngine({ provider, maxRequests: 2 })
  const summary = await engine.discover({ seed: 'chipotle menu', country: 'us' })

  assert.equal(summary.uniqueSuggestions, 3)
  assert.deepEqual(summary.discoveries.map(item => item.phrase), [
    'Chipotle Menu Nutrition',
    'Chipotle Menu Prices',
    'Chipotle Menu Calories'
  ])
  assert.deepEqual(summary.discoveries[0], {
    originalSeed: 'chipotle menu',
    expansionQuery: 'chipotle menu a',
    country: 'us',
    source: 'Google Autocomplete via Microlink Search',
    discoveryDepth: 1,
    phrase: 'Chipotle Menu Nutrition'
  })
})

test('enforces the engine request budget while retaining all generated patterns', async () => {
  const calls = []
  const engine = createAlphabetExpansionEngine({
    provider: { async autocomplete({ seed }) { calls.push(seed); return response([seed]) } },
    maxRequests: 2
  })
  const summary = await engine.discover({ seed: 'chipotle menu', country: 'us' })

  assert.deepEqual(calls, ['chipotle menu a', 'chipotle menu b'])
  assert.equal(summary.plannedQueries.length, 26)
  assert.equal(summary.completedRequests, 2)
  assert.equal(summary.skippedExpansionQueries.length, 24)
  assert.equal(summary.uniqueSuggestions, 2)
})

test('retains successful suggestions when individual provider requests fail', async () => {
  const engine = createAlphabetExpansionEngine({
    provider: {
      async autocomplete({ seed }) {
        if (seed.endsWith(' b')) {
          const error = new Error('temporary provider outage')
          error.code = 'PROVIDER_REQUEST_FAILED'
          throw error
        }
        return response([`${seed} suggestion`])
      }
    },
    maxRequests: 3
  })
  const summary = await engine.discover({ seed: 'chipotle menu', country: 'us' })

  assert.equal(summary.completedRequests, 3)
  assert.equal(summary.successfulRequests, 2)
  assert.equal(summary.errors.length, 1)
  assert.equal(summary.errors[0].expansionQuery, 'chipotle menu b')
  assert.deepEqual(summary.discoveries.map(item => item.phrase), [
    'chipotle menu a suggestion',
    'chipotle menu c suggestion'
  ])
})

test('terminates the remaining queue after the provider hard budget is exhausted', async () => {
  const calls = []
  const engine = createAlphabetExpansionEngine({
    provider: {
      async autocomplete({ seed }) {
        calls.push(seed)
        if (seed.endsWith(' b')) {
          const error = new Error('Keyword discovery request budget is exhausted.')
          error.code = 'USAGE_BUDGET_EXHAUSTED'
          throw error
        }
        return response([seed])
      }
    },
    maxRequests: 4
  })
  const summary = await engine.discover({ seed: 'chipotle menu', country: 'us' })

  assert.deepEqual(calls, ['chipotle menu a', 'chipotle menu b'])
  assert.equal(summary.terminatedEarly, true)
  assert.equal(summary.completedRequests, 2)
  assert.deepEqual(summary.skippedExpansionQueries, ['chipotle menu e', 'chipotle menu f', 'chipotle menu g', 'chipotle menu h', 'chipotle menu i', 'chipotle menu j', 'chipotle menu k', 'chipotle menu l', 'chipotle menu m', 'chipotle menu n', 'chipotle menu o', 'chipotle menu p', 'chipotle menu q', 'chipotle menu r', 'chipotle menu s', 'chipotle menu t', 'chipotle menu u', 'chipotle menu v', 'chipotle menu w', 'chipotle menu x', 'chipotle menu y', 'chipotle menu z', 'chipotle menu c', 'chipotle menu d'])
})
