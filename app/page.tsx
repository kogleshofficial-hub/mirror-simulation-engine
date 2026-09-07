'use client'

import { useEffect, useMemo, useState } from 'react'
import { parseScenario, simulate, summarize, type Model, type State } from '../lib/engine'

const demo = 'I want to launch a small online store. I have 3 developers, around 500 orders to handle, and 2 days. What happens if one developer becomes unavailable halfway through?'
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function LineChart({ states, minute }: { states: State[]; minute: number }) {
  const width = 760, height = 190, pad = 22
  const max = Math.max(1, ...states.map(s => s.queue))
  const points = states.map((s, i) => `${pad + (i / Math.max(1, states.length - 1)) * (width - pad * 2)},${height - pad - (s.queue / max) * (height - pad * 2)}`).join(' ')
  const x = pad + (Math.max(0, minute - 1) / Math.max(1, states.length - 1)) * (width - pad * 2)
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="System pressure over simulated time"><line x1={pad} x2={width-pad} y1={height-pad} y2={height-pad} className="axis"/><polyline points={points} className="chart-line"/><line x1={x} x2={x} y1={pad} y2={height-pad} className="cursor"/></svg><div className="chart-axis"><span>00:00</span><span>{clock(Math.round((states.length || 0) / 2))}</span><span>{clock(states.at(-1)?.minute ?? 0)}</span></div></div>
}

function changeModel(model: Model, request: string): Model | null {
  const lower = request.toLowerCase()
  const valueMatch = request.match(/(?:to|=)\s*(\d[\d,]*(?:\.\d+)?)/i)
  const n = valueMatch ? Math.max(0, Number(valueMatch[1].replace(/,/g, ''))) : null
  if (n !== null && /attendees|students|people|users|customers|orders|tasks|items|units|tickets|requests|visitors|products|packages|deliveries|jobs|records|work/i.test(lower)) return { ...model, subjectCount: n }
  if (n !== null && /organizers|staff|workers|worker|developers|developer|engineers|servers|machines|agents|vehicles|drivers|rooms|printers|lanes|teams|resources|operators|reviewers/i.test(lower)) return { ...model, resourceCount: n }
  if (n !== null && /capacity|throughput|rate|per minute|min/i.test(lower)) return { ...model, capacityPerResource: Math.max(0.25, n) }
  if (n !== null && /minutes|min|duration/i.test(lower)) return { ...model, durationMinutes: Math.max(15, Math.round(n)) }
  if (n !== null && /hours|hrs|hr/i.test(lower)) return { ...model, durationMinutes: Math.max(15, Math.round(n * 60)) }
  if (n !== null && /days|day/i.test(lower)) return { ...model, durationMinutes: Math.max(15, Math.round(n * 1440)) }
  return null
}

export default function Home() {
  const [text, setText] = useState(demo)
  const [model, setModel] = useState<Model>(() => parseScenario(demo))
  const [whatIf, setWhatIf] = useState('')
  const [minute, setMinute] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [changeNote, setChangeNote] = useState('')
  const states = useMemo(() => simulate(model), [model])
  const summary = useMemo(() => summarize(model), [model])
  const baseline = useMemo(() => summarize({ ...model, lossAt: null, lossAmount: 0 }), [model])
  const state = minute === 0 ? { minute: 0, resources: model.resourceCount, capacityPerMinute: model.resourceCount * model.capacityPerResource, arrivals: 0, completed: 0, queue: 0, utilization: 0, bottleneck: model.resourceLabel } : states[Math.min(minute, states.length) - 1]
  const eventActive = model.lossAt !== null && minute >= model.lossAt
  const delay = Math.max(0, summary.completionMinute - baseline.completionMinute)
  const pct = Math.min(100, minute / model.durationMinutes * 100)
  const remaining = Math.max(0, model.subjectCount - state.completed)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setMinute(m => {
      if (m >= model.durationMinutes) { setRunning(false); return m }
      return m + 1
    }), 30)
    return () => window.clearInterval(id)
  }, [running, model.durationMinutes])

  const run = () => {
    const m = parseScenario(text)
    if (m.subjectCount < 1 || m.resourceCount < 1) { setError('MIRROR needs a measurable amount of work and at least one available resource.'); return }
    setError(''); setChangeNote(''); setModel(m); setMinute(0); setRunning(true)
  }
  const applyChange = () => {
    const changed = changeModel(model, whatIf)
    if (!changed || changed.subjectCount < 1 || changed.resourceCount < 1) { setError('Try “increase users to 1000”, “reduce workers to 2”, “increase capacity to 5”, or “give us 6 hours”.'); return }
    setError(''); setRunning(false); setMinute(0); setModel(changed); setChangeNote(`Applied: ${whatIf.trim()}`); setWhatIf('')
  }
  const reset = () => { setRunning(false); setMinute(0); setError(''); setChangeNote('') }

  return <main className="shell">
    <header className="top"><div className="brand"><div className="mark">M</div><strong>MIRROR</strong></div><div className="status"><i className="dot"/> {running ? 'simulation running' : minute >= model.durationMinutes ? 'simulation complete' : 'engine ready'}</div></header>
    <section className="hero"><div className="eyebrow">General-purpose decision simulation</div><h1>Test the decision<br/><span>before reality does.</span></h1><p>Describe a measurable situation in plain language. MIRROR extracts the moving parts, simulates the system, and shows the consequences of changing a condition.</p><div className="domain-pills"><span>operations</span><span>projects</span><span>business</span><span>events</span><span>logistics</span><span>teams</span><span>systems</span></div></section>

    <section className="workspace">
      <aside className="panel input-panel"><div className="label">01 / Describe reality</div><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} aria-label="Scenario description"/><div className="actions"><button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run simulation'}</button><button className="secondary" onClick={reset}>Reset</button></div>{error && <div className="error">{error}</div>}
        <button className="demo" onClick={() => setText(demo)}><span>EXAMPLE</span><b>Online store launch</b><small>500 orders · 3 developers · 2 days · one developer unavailable halfway</small></button>
        <div className="extracted"><div className="label">02 / Model extracted</div><div className="chips"><span>{fmt(model.subjectCount)} {model.subjectLabel}</span><span>{model.resourceCount} {model.resourceLabel}</span><span>{model.capacityPerResource}/resource/min</span><span>{Math.round(model.durationMinutes / 60)}h window</span>{model.lossAt !== null && <span>−{model.lossAmount} @ {clock(model.lossAt)}</span>}</div></div>
      </aside>

      <section className="panel sim"><div className="simhead"><div><div className="label">03 / Live simulation</div><div className="simtitle">{model.subjectLabel} system</div><div className="sub">The engine advances the model state by state. The output is computed, not generated.</div></div><div className={`clock ${running ? 'live' : ''}`}><i/>{clock(minute)}<span>/ {clock(model.durationMinutes)}</span></div></div>
        <div className="metrics"><div className={`metric ${state.queue > 0 ? 'attention' : ''}`}><span>In queue</span><b>{fmt(state.queue)}</b><small>{model.subjectLabel} waiting</small></div><div className="metric"><span>Completed</span><b>{fmt(state.completed)}</b><small>of {fmt(model.subjectCount)}</small></div><div className="metric"><span>Capacity</span><b>{fmt(state.capacityPerMinute)}<em>/min</em></b><small>current throughput</small></div><div className={`metric ${eventActive ? 'attention' : ''}`}><span>Resources</span><b>{fmt(state.resources)}/{fmt(model.resourceCount)}</b><small>{eventActive ? 'reduced' : 'available'}</small></div></div>

        <div className="stage"><div className="stage-head"><span>LIVE SYSTEM STATE</span><span className={eventActive ? 'danger' : ''}>{eventActive ? `RESOURCE CHANGE · ${clock(model.lossAt ?? 0)}` : 'NORMAL OPERATION'}</span></div><div className="system">
          <div className="entity-block"><div className="entity-icon">{fmt(state.arrivals)}</div><strong>DEMAND</strong><small>arrived so far</small></div>
          <div className="connector"><i/><i/><i/></div>
          <div className={`entity-block queue-node ${state.queue > 0 ? 'hot' : ''}`}><div className="entity-icon">{fmt(state.queue)}</div><strong>PRESSURE</strong><small>{state.queue > 0 ? 'work accumulating' : 'system clear'}</small></div>
          <div className="connector"><i/><i/><i/></div>
          <div className={`entity-block ${eventActive ? 'hot' : ''}`}><div className="staff-stack">{Array.from({length: Math.max(1, model.resourceCount)}, (_, i) => <i key={i} className={i < state.resources ? 'on' : 'off'}/>)}</div><strong>CAPACITY</strong><small>{fmt(state.capacityPerMinute)}/min available</small></div>
        </div><div className="event-strip"><span className={minute > 0 ? 'passed' : ''}>01 <b>Demand</b>{model.profile === 'front-loaded' ? 'front-loaded' : 'steady'} profile</span>{model.lossAt !== null && <span className={eventActive ? 'passed' : ''}>02 <b>Resource change</b>{clock(model.lossAt)}</span>}<span>03 <b>Outcome</b>{summary.completionMinute >= model.durationMinutes ? 'window end' : clock(summary.completionMinute)}</span></div></div>

        <div className="progress"><span style={{width: `${pct}%`}}/></div>
        <div className="insight"><div className="insight-kicker">WHAT THE MODEL FOUND</div><strong>{summary.peakQueue > 0 ? `${fmt(summary.peakQueue)} ${model.subjectLabel} build up at the peak.` : 'The system keeps pace with the modeled demand.'}</strong><p>{delay > 0 ? `The resource change adds ${delay} simulated minutes to completion. ${fmt(remaining)} remain at the current clock.` : `${fmt(summary.totalCompleted)} are completed under the current assumptions. Change a condition below to test another outcome.`}</p></div>

        <div className="change-box"><div><div className="label">04 / WHAT IF?</div><strong>Change the model in your own words.</strong><small>Test demand, resources, capacity, or time without rebuilding the scenario.</small></div><div className="change-row"><input value={whatIf} onChange={e => setWhatIf(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyChange() }} placeholder="e.g. increase users to 1000" aria-label="What if change"/><button className="secondary" onClick={applyChange}>Apply</button></div>{changeNote && <div className="change-note">{changeNote} · Run the simulation to see the consequence.</div>}</div>
      </section>
    </section>

    <section className="analysis"><div className="section-head"><div><div className="label">05 / Decision impact</div><h2>See the consequence, not just the number.</h2></div><span className="badge">DETERMINISTIC ENGINE</span></div><div className="analysis-grid">
      <div className="panel chart-card"><div className="card-title"><div><strong>System pressure</strong><small>Accumulated work over simulated time</small></div><b>{fmt(summary.peakQueue)} <span>peak</span></b></div><LineChart states={states} minute={minute}/></div>
      <div className="panel result-card"><div className="card-title"><div><strong>Baseline vs changed condition</strong><small>Same model, resource event removed</small></div></div><div className="compare"><div><span>CHANGED</span><b>{clock(summary.completionMinute)}</b><small>completion</small></div><div className="arrow">→</div><div><span>BASELINE</span><b>{clock(baseline.baselineCompletionMinute)}</b><small>completion</small></div></div><div className="impact"><b>{delay > 0 ? `+${delay} min` : 'No delay'}</b><span>completion impact</span></div><div className="decision"><b>Decision signal</b><p>{summary.peakQueue > 0 ? `The model is capacity-constrained. Add ${model.resourceLabel}, increase capacity, or reduce demand during the busiest period.` : `The modeled ${model.resourceLabel} capacity is sufficient for this demand profile.`}</p></div></div>
    </div></section>

    <section className="model"><div className="label">06 / Model transparency</div><div className="modelgrid"><div className="modelcard"><h3>General primitives</h3><p>Demand, resources, capacity, time, arrival profile, and resource events are modeled as explicit variables rather than hard-coded to one industry.</p></div><div className="modelcard"><h3>Deterministic core</h3><p>The engine advances state through arrivals, available capacity, completion, queue pressure, and resource changes. Identical inputs produce identical outputs.</p></div><div className="modelcard"><h3>Natural changes</h3><p>Users can test changes to demand, resources, throughput, or time without rebuilding the scenario from scratch.</p></div><div className="modelcard"><h3>Honest boundaries</h3><p>MIRROR currently simulates measurable flow and capacity problems. Domain-specific physics, finance, weather, and other specialized models can be added as separate engines instead of pretending one formula fits everything.</p></div></div></section>
    <footer className="footer">MIRROR · Test the decision before reality does. · Built by <strong>Koglesh R. Murugan</strong></footer>
  </main>
}
