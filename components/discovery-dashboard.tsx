'use client'

import { FormEvent, useMemo, useState } from 'react'
import { toKeywordRows } from '../src/ui/discovery-results.js'

type Discovery = { originalSeed: string; expansionQuery: string; country: string; source: string; discoveryDepth: number; phrase: string }
type Summary = { requestBudget: number; plannedQueries: string[]; completedRequests: number; successfulRequests: number; errors: Array<{ expansionQuery: string; code: string; message: string }>; skippedExpansionQueries: string[]; uniqueSuggestions: number; discoveries: Discovery[] }
type DiscoverResponse = { seed: string; country: string; language?: string; languageApplied: boolean; expansionType: 'alphabet'; summary: Summary }

const countries = [['us', 'United States'], ['ca', 'Canada'], ['gb', 'United Kingdom'], ['au', 'Australia'], ['de', 'Germany'], ['fr', 'France'], ['es', 'Spain'], ['it', 'Italy'], ['br', 'Brazil'], ['mx', 'Mexico'], ['in', 'India'], ['jp', 'Japan']]
const languages = [['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['ja', 'Japanese']]
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

export function DiscoveryDashboard() {
  const [seed, setSeed] = useState('chipotle menu')
  const [country, setCountry] = useState('us')
  const [language, setLanguage] = useState('en')
  const [maxRequests, setMaxRequests] = useState(25)
  const [result, setResult] = useState<DiscoverResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [filter, setFilter] = useState('')
  const [ascending, setAscending] = useState(true)
  const [copyMessage, setCopyMessage] = useState('')

  const rows = useMemo(() => {
    const query = filter.trim().toLowerCase()
    return toKeywordRows(result?.summary.discoveries)
      .filter(row => !query || row.keyword.toLowerCase().includes(query) || row.expansionQuery.toLowerCase().includes(query))
      .sort((a, b) => ascending ? a.keyword.localeCompare(b.keyword) : b.keyword.localeCompare(a.keyword))
  }, [result, filter, ascending])

  const copy = async (text: string, message: string) => {
    try { await navigator.clipboard.writeText(text); setCopyMessage(message) }
    catch { setCopyMessage('Copy is unavailable in this browser.') }
  }

  const exportCsv = () => {
    if (!rows.length) return
    const header = ['Keyword', 'Expansion query', 'Country', 'Source', 'Depth']
    const records = rows.map(row => [row.keyword, row.expansionQuery, row.country, row.source, row.depth])
    const blob = new Blob([[header, ...records].map(record => record.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'queryscope-keywords.csv'; anchor.click(); URL.revokeObjectURL(url)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setRunning(true); setError(null); setCopyMessage('')
    try {
      const response = await fetch('/api/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed, country, language, maxRequests, expansionType: 'alphabet' }) })
      const data = await response.json() as DiscoverResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Discovery could not be completed.')
      setResult(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Discovery could not be completed.')
    } finally { setRunning(false) }
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400 font-black text-slate-950">Q</div><div><h1 className="text-xl font-bold tracking-tight">QueryScope</h1><p className="text-sm text-slate-400">Focused keyword discovery</p></div></div><span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">Phase 1 · A–Z</span></header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="mb-6 max-w-2xl"><p className="text-sm font-semibold text-cyan-300">Google Autocomplete discovery</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Start with a seed. Discover the phrasing people see.</h2><p className="mt-3 text-sm leading-6 text-slate-400">QueryScope sends A–Z suffix queries through Microlink and returns only provider-supplied suggestions. It does not estimate volume, CPC, or difficulty.</p></div>
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-6">
          <label className="lg:col-span-2"><span className="label">Seed keyword</span><input className="control" value={seed} onChange={event => setSeed(event.target.value)} maxLength={120} required /></label>
          <label><span className="label">Country</span><select className="control" value={country} onChange={event => setCountry(event.target.value)}>{countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <label><span className="label">Language</span><select className="control" value={language} onChange={event => setLanguage(event.target.value)}>{languages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select><span className="mt-1 block text-xs text-amber-200/80">Current provider uses country; language cannot be enforced.</span></label>
          <label><span className="label">Max requests</span><select className="control" value={maxRequests} onChange={event => setMaxRequests(Number(event.target.value))}>{[5, 10, 15, 20, 25].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <div className="flex flex-col justify-end"><span className="label">Expansion type</span><div className="control flex items-center text-sm text-slate-300">A–Z autocomplete</div></div>
          <button className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60" disabled={running}>{running ? 'Discovering…' : 'Discover Keywords'}</button>
        </form>
        {running && <p className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm text-cyan-100" role="status">Discovery is running. Requests are processed server-side; results will show completed work and any real provider errors.</p>}
        {error && <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100" role="alert">{error}</p>}
      </section>

      {!result && !running && !error && <section className="mt-6 rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-400"><p className="font-medium text-slate-200">Ready when you are.</p><p className="mt-2 text-sm">Enter a seed keyword and run A–Z discovery to view actual provider-returned suggestions.</p></section>}
      {result && <Results result={result} rows={rows} filter={filter} setFilter={setFilter} ascending={ascending} setAscending={setAscending} copy={copy} copyMessage={copyMessage} exportCsv={exportCsv} />}
    </div>
  </main>
}

function Results({ result, rows, filter, setFilter, ascending, setAscending, copy, copyMessage, exportCsv }: { result: DiscoverResponse; rows: ReturnType<typeof toKeywordRows>; filter: string; setFilter: (value: string) => void; ascending: boolean; setAscending: (value: boolean | ((current: boolean) => boolean)) => void; copy: (text: string, message: string) => Promise<void>; copyMessage: string; exportCsv: () => void }) {
  return <section className="mt-6 space-y-4">
    <div className="grid gap-3 sm:grid-cols-4"><Metric label="Unique suggestions" value={result.summary.uniqueSuggestions} /><Metric label="Completed" value={`${result.summary.completedRequests}/${result.summary.plannedQueries.length}`} /><Metric label="Provider errors" value={result.summary.errors.length} /><Metric label="Unrequested patterns" value={result.summary.skippedExpansionQueries.length} /></div>
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold">Google Autocomplete suggestions retrieved through Microlink</h2><p className="mt-1 text-sm text-slate-400">Actual provider-returned suggestions. They are not an exhaustive inventory of all Google searches.</p></div><div className="flex gap-2"><button className="secondary-button" onClick={() => copy(rows.map(row => row.keyword).join('\n'), 'Keywords copied.')}>Copy all</button><button className="secondary-button" onClick={exportCsv} disabled={!rows.length}>Export CSV</button></div></div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input aria-label="Filter keywords" className="control max-w-md" placeholder="Filter keyword or expansion query" value={filter} onChange={event => setFilter(event.target.value)} />{copyMessage && <p className="self-center text-sm text-cyan-200" role="status">{copyMessage}</p>}</div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><thead className="bg-slate-800/80 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3"><button className="hover:text-cyan-200" onClick={() => setAscending(value => !value)}>Keyword {ascending ? '↑' : '↓'}</button></th><th className="px-4 py-3">Expansion query</th><th className="px-4 py-3">Country</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Depth</th><th className="px-4 py-3"><span className="sr-only">Copy</span></th></tr></thead><tbody className="divide-y divide-slate-800">{rows.map(row => <tr key={row.id} className="text-slate-300"><td className="px-4 py-3 font-medium text-slate-100">{row.keyword}</td><td className="px-4 py-3 text-slate-400">{row.expansionQuery}</td><td className="px-4 py-3 uppercase">{row.country}</td><td className="px-4 py-3 text-slate-400">{row.source}</td><td className="px-4 py-3">{row.depth}</td><td className="px-4 py-3"><button className="text-cyan-300 hover:text-cyan-200" onClick={() => copy(row.keyword, 'Keyword copied.')}>Copy</button></td></tr>)}</tbody></table></div>
      {!rows.length && <p className="p-6 text-center text-sm text-slate-400">No returned suggestions match this filter.</p>}
    </div>
    {!!result.summary.errors.length && <details className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4"><summary className="cursor-pointer font-medium text-amber-100">{result.summary.errors.length} provider request error{result.summary.errors.length === 1 ? '' : 's'}</summary><ul className="mt-3 space-y-2 text-sm text-amber-50">{result.summary.errors.map(error => <li key={error.expansionQuery}><code>{error.expansionQuery}</code>: {error.message}</li>)}</ul></details>}
  </section>
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div> }
