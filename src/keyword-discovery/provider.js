/**
 * Provider contract for keyword discovery. A replacement API needs only this
 * method and must return the same normalized response shape.
 *
 * @typedef {Object} KeywordDiscoveryProvider
 * @property {(input: { seed: string, country?: string, language?: string }) => Promise<{
 *   source: string,
 *   suggestions: Array<{ value: string, source: string }>,
 *   country: string,
 *   language: string | undefined,
 *   languageApplied: boolean,
 *   cached: boolean
 * }>} autocomplete
 */

export class KeywordDiscoveryError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause })
    this.name = 'KeywordDiscoveryError'
    this.code = code
    this.retryAfterMs = options.retryAfterMs
  }
}
