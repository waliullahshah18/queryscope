import test from 'node:test'
import assert from 'node:assert/strict'
import { createMicrolinkAutocompleteProvider } from '../src/keyword-discovery/microlink-autocomplete-provider.js'

test('normalizes, labels, caches, and budgets Autocomplete requests', async () => {
  const calls = []
  const provider = await createMicrolinkAutocompleteProvider({
    apiKey: 'server-only-test-key',
    maxRequests: 1,
    client: {
      async search(seed, options) {
        calls.push({ seed, options })
        return { results: [{ value: 'chipotle menu nutrition' }, { value: 'chipotle menu prices' }] }
      }
    }
  })

  const first = await provider.autocomplete({ seed: 'chipotle menu', country: 'US', language: 'en' })
  const second = await provider.autocomplete({ seed: 'chipotle menu', country: 'us', language: 'en' })

  assert.deepEqual(calls, [{ seed: 'chipotle menu', options: { type: 'autocomplete', location: 'us' } }])
  assert.equal(first.source, 'Google Autocomplete via Microlink Search')
  assert.equal(first.suggestions[0].source, first.source)
  assert.equal(first.languageApplied, false)
  assert.equal(second.cached, true)
  assert.deepEqual(provider.getUsage(), { requestCount: 1, maxRequests: 1, remaining: 0 })
  await assert.rejects(
    provider.autocomplete({ seed: 'chipotle menu near me', country: 'us' }),
    error => error.code === 'USAGE_BUDGET_EXHAUSTED'
  )
})

test('does not fabricate suggestions if Microlink fails', async () => {
  const provider = await createMicrolinkAutocompleteProvider({
    apiKey: 'server-only-test-key',
    client: { async search() { throw new Error('upstream unavailable') } }
  })

  await assert.rejects(
    provider.autocomplete({ seed: 'chipotle menu' }),
    error => error.code === 'PROVIDER_REQUEST_FAILED'
  )
})

test('coalesces identical concurrent requests and never lets them bypass the budget', async () => {
  let resolveSearch
  const searchFinished = new Promise(resolve => { resolveSearch = resolve })
  let calls = 0
  const provider = await createMicrolinkAutocompleteProvider({
    apiKey: 'server-only-test-key',
    maxRequests: 1,
    client: {
      async search() {
        calls += 1
        await searchFinished
        return { results: [{ value: 'chipotle menu calories' }] }
      }
    }
  })

  const first = provider.autocomplete({ seed: 'chipotle menu', country: 'us' })
  const second = provider.autocomplete({ seed: 'chipotle menu', country: 'us' })
  await assert.rejects(
    provider.autocomplete({ seed: 'chipotle menu near me', country: 'us' }),
    error => error.code === 'USAGE_BUDGET_EXHAUSTED'
  )
  resolveSearch()
  const [firstResult, secondResult] = await Promise.all([first, second])

  assert.equal(calls, 1)
  assert.equal(firstResult.cached, false)
  assert.equal(secondResult.cached, true)
  assert.deepEqual(provider.getUsage(), { requestCount: 1, maxRequests: 1, remaining: 0 })
})

test('turns an upstream 429 into a cooldown without another provider request', async () => {
  let calls = 0
  const provider = await createMicrolinkAutocompleteProvider({
    apiKey: 'server-only-test-key',
    now: () => 1_000,
    client: {
      async search() {
        calls += 1
        throw { statusCode: 429, headers: { 'retry-after': '2' } }
      }
    }
  })

  await assert.rejects(
    provider.autocomplete({ seed: 'chipotle menu' }),
    error => error.code === 'RATE_LIMITED' && error.retryAfterMs === 2_000
  )
  await assert.rejects(
    provider.autocomplete({ seed: 'chipotle menu prices' }),
    error => error.code === 'RATE_LIMITED' && error.retryAfterMs === 2_000
  )
  assert.equal(calls, 1)
})
