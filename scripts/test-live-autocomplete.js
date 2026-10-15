import { createMicrolinkAutocompleteProvider } from '../src/keyword-discovery/microlink-autocomplete-provider.js'

const SEED = 'chipotle menu'

const readCountry = args => {
  if (args.length === 0) return 'us'
  if (args.length === 2 && args[0] === '--country') return args[1]
  if (args.length === 1 && args[0].startsWith('--country=')) return args[0].slice('--country='.length)
  throw new Error('Usage: npm run test:live -- [--country <ISO-3166-1-alpha-2>]')
}

const safeDisplay = value => value.replace(/[\u0000-\u001f\u007f]/g, ' ')

try {
  const country = readCountry(process.argv.slice(2))
  const provider = await createMicrolinkAutocompleteProvider()
  const result = await provider.autocomplete({ seed: SEED, country })

  if (result.suggestions.length === 0) {
    throw new Error('Microlink returned no valid autocomplete suggestions.')
  }

  console.log('Google Autocomplete results retrieved through Microlink')
  console.log(`Seed keyword: ${SEED}`)
  console.log(`Country: ${result.country}`)
  console.log(`Actual suggestions returned: ${result.suggestions.length}`)
  for (const suggestion of result.suggestions) console.log(`- ${safeDisplay(suggestion.value)}`)
  console.log('These are provider-returned autocomplete suggestions, not a complete inventory of Google-related queries.')
} catch (error) {
  console.error(`Live autocomplete test failed${error?.code ? ` (${error.code})` : ''}: ${error?.message || 'Unknown error'}`)
  process.exitCode = 1
}
