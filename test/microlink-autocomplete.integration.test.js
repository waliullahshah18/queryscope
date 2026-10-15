import test from 'node:test'
import assert from 'node:assert/strict'

const apiKey = process.env.MICROLINK_API_KEY

test('Microlink Google Autocomplete returns sourced suggestions for chipotle menu', {
  skip: !apiKey && 'Set a free or paid Microlink Search MICROLINK_API_KEY to run this live test.'
}, async () => {
  const { createMicrolinkAutocompleteProvider } = await import('../src/keyword-discovery/microlink-autocomplete-provider.js')
  const provider = await createMicrolinkAutocompleteProvider({ apiKey, maxRequests: 1 })
  const result = await provider.autocomplete({ seed: 'chipotle menu', country: 'us', language: 'en' })

  assert.equal(result.source, 'Google Autocomplete via Microlink Search')
  assert.equal(result.country, 'us')
  assert.equal(result.language, 'en')
  assert.equal(result.languageApplied, false, 'Microlink documents country selection, not an Autocomplete language parameter.')
  assert.ok(Array.isArray(result.suggestions))
  assert.ok(result.suggestions.length > 0, 'Microlink returned no autocomplete suggestions for the live seed.')
  assert.ok(result.suggestions.every(item => item.source === result.source && typeof item.value === 'string' && item.value.trim()))
})
