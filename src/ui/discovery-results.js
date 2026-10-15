export function toKeywordRows(discoveries = []) {
  return discoveries.map((discovery, index) => ({
    id: `${discovery.expansionQuery}-${discovery.phrase}-${index}`,
    keyword: discovery.phrase,
    expansionQuery: discovery.expansionQuery,
    country: discovery.country,
    source: discovery.source,
    depth: discovery.discoveryDepth
  }))
}
