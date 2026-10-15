import test from 'node:test'
import assert from 'node:assert/strict'
import { toKeywordRows } from '../src/ui/discovery-results.js'

test('maps actual API discoveries to rows used by the results table', () => {
  const rows = toKeywordRows([{ originalSeed: 'chipotle menu', expansionQuery: 'chipotle menu a', country: 'us', source: 'Google Autocomplete via Microlink Search', discoveryDepth: 1, phrase: 'chipotle menu allergy menu' }])
  assert.deepEqual(rows[0], { id: 'chipotle menu a-chipotle menu allergy menu-0', keyword: 'chipotle menu allergy menu', expansionQuery: 'chipotle menu a', country: 'us', source: 'Google Autocomplete via Microlink Search', depth: 1 })
})
