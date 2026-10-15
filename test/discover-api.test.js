import test from 'node:test'
import assert from 'node:assert/strict'
import { handleDiscoverRequest } from '../src/server/discovery-service.js'

const source = 'Google Autocomplete via Microlink Search'
const provider = {
  async autocomplete({ seed, country }) {
    if (seed.endsWith(' b')) throw Object.assign(new Error('upstream failure'), { code: 'PROVIDER_REQUEST_FAILED' })
    return { source, country, suggestions: [{ value: `${seed} suggestion`, source }] }
  }
}

test('validates discovery input before creating a provider', async () => {
  let called = false
  const result = await handleDiscoverRequest({ seed: '', country: 'zz', expansionType: 'alphabet', maxRequests: 26 }, { getProvider: async () => { called = true; return provider } })
  assert.equal(result.status, 400)
  assert.equal(called, false)
  assert.equal(result.body.error, 'Invalid discovery request.')
})

test('API handler returns actual discovery metadata and preserves partial results', async () => {
  const result = await handleDiscoverRequest({ seed: 'chipotle menu', country: 'us', language: 'en', expansionType: 'alphabet', maxRequests: 3 }, { getProvider: async () => provider })
  assert.equal(result.status, 200)
  assert.equal(result.body.languageApplied, false)
  assert.equal(result.body.summary.completedRequests, 3)
  assert.equal(result.body.summary.errors.length, 1)
  assert.deepEqual(result.body.summary.discoveries.map(item => item.phrase), ['chipotle menu a suggestion', 'chipotle menu c suggestion'])
  assert.equal(result.body.summary.discoveries[0].source, source)
})

test('API handler gives a safe missing-key error', async () => {
  const missingKey = Object.assign(new Error('do not expose implementation details'), { code: 'MISSING_API_KEY' })
  const result = await handleDiscoverRequest({ seed: 'chipotle menu', country: 'us', expansionType: 'alphabet', maxRequests: 1 }, { getProvider: async () => { throw missingKey } })
  assert.equal(result.status, 503)
  assert.equal(result.body.error, 'Keyword discovery is not configured on this server.')
  assert.equal(JSON.stringify(result.body).includes('implementation details'), false)
})
