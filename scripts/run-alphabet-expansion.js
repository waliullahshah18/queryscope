import { createAlphabetExpansionEngine } from '../src/keyword-discovery/alphabet-expansion-engine.js'
import { createMicrolinkAutocompleteProvider } from '../src/keyword-discovery/microlink-autocomplete-provider.js'

const SEED = 'chipotle menu'

const readOptions = args => {
  const options = { country: 'us', maxRequests: 25 }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--country') options.country = args[++index]
    else if (argument.startsWith('--country=')) options.country = argument.slice('--country='.length)
    else if (argument === '--max-requests') options.maxRequests = Number(args[++index])
    else if (argument.startsWith('--max-requests=')) options.maxRequests = Number(argument.slice('--max-requests='.length))
    else throw new Error('Usage: npm run discover:alphabet -- [--country <ISO-3166-1-alpha-2>] [--max-requests <0-26>]')
  }
  return options
}

const safeDisplay = value => String(value).replace(/[\u0000-\u001f\u007f]/g, ' ')

try {
  const { country, maxRequests } = readOptions(process.argv.slice(2))
  const provider = await createMicrolinkAutocompleteProvider()
  const engine = createAlphabetExpansionEngine({
    provider,
    maxRequests,
    onProgress: event => {
      if (event.type === 'start') {
        console.log(`Generated query patterns: ${event.plannedRequests}; scheduled requests: ${event.scheduledRequests}; run budget: ${event.requestBudget}.`)
      } else if (event.type === 'request-start') {
        console.log(`[${event.requestNumber}/${event.totalRequests}] Requesting: ${event.expansionQuery}`)
      } else if (event.type === 'request-complete') {
        console.log(`[${event.requestNumber}/${event.totalRequests}] Completed: ${event.expansionQuery} (${event.returnedSuggestions} returned; ${event.uniqueSuggestions} unique).`)
      } else if (event.type === 'request-error') {
        console.error(`[${event.requestNumber}/${event.totalRequests}] Error: ${event.expansionQuery} (${event.code}).`)
      }
    }
  })
  const summary = await engine.discover({ seed: SEED, country })

  console.log(`Completed requests: ${summary.completedRequests}; errors: ${summary.errors.length}.`)
  console.log(`Unique suggestions discovered: ${summary.uniqueSuggestions}.`)
  console.log('Provider-returned suggestions:')
  for (const discovery of summary.discoveries) {
    console.log(`- ${safeDisplay(discovery.phrase)} [from: ${safeDisplay(discovery.expansionQuery)}; depth: ${discovery.discoveryDepth}]`)
  }
  if (summary.skippedExpansionQueries.length) {
    console.log(`Patterns not requested: ${summary.skippedExpansionQueries.length}.`)
  }
  console.log('These are provider-returned autocomplete suggestions, not a complete inventory of Google-related queries.')
} catch (error) {
  console.error(`Alphabet discovery failed${error?.code ? ` (${error.code})` : ''}: ${error?.message || 'Unknown error'}`)
  process.exitCode = 1
}
