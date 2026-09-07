'use client'

import { useEffect, useMemo, useState } from 'react'
import { parseScenario, simulate, summarize, type Model, type State } from '../lib/engine'

const demo = 'I want to run a school event for around 200 students. I have 3 organizers, 2 registration desks, and about 2 hours. What happens if one organizer leaves halfway through?'
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function LineChart({ states, minute }: { states: State[]; minute: number }) {
  const width = 760, height = 190, pad = 22
  const max = Math.max(1, ...states.map(s => s.queue))
  const points = states.map((s, i) => `${pad + (i / Math.max(1, states.length - 1)) * (width - pad * 2)},${height - pad - (s.queue / max) * (height - pad * 2)}`).join(' ')
  const x = pad + (Math.max(0, minute - 1) / Math.max(1, states.length - 1)) * (width - pad * 2)
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Queue size over simulated time"><line x1={pad} x2={width-pad} y1={height-pad} y2={height-pad} className="axis"/><polyline points={points} className="chart-line"/><line x1={x} x2={x} y1={pad} y2={height-pad} className="cursor"/></svg><div className="chart-axis"><span>00:00</span><span>{clock(Math.round((states.length || 0) / 2))}</span><span>{clock(states.at(-1)?.minute ?? 0)}</span></div></div>
}

function applyWhatIf(model: Model, request: string): Model | null {
  const value = request.match(/(?:to|=)\s*(\d[\d,]*)/i)?.[1]
  if (!value) return null
  const n = Math.max(0, Number(value.replace(/,/g, '')))
  if (/attendees|students|people/i.test(request)) return { ...model, attendees: n }
  if (/organizers|organizer|staff|workers|worker/i.test(request)) return { ...model, organizers: n }
  if (/desks|counters|stations/i.test(request)) return { ...model, desks: n }
  const hours = request.match(/(?:duration|event|run).*(?:to|=)\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i)
  if (hours) return { ...model, durationMinutes: Math.max(30, Math.round(Number(hours[1]) * 60)) }
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
  const baseline = useMemo(() => summarize({ ...model, lossAt: null }), [model])
  const state = minute === 0 ? { minute: 0, workers: model.organizers, capacityPerMinute: Math.min(model.desks * 3, model.organizers * 2), arrivals: 0, served: 0, queue: 0, bottleneck: 'Organizers' as const } : states[Math.min(minute, states.length) - 1]
  const eventActive = model.lossAt !== null && minute >= model.lossAt
  const delay = Math.max(0, summary.completionMinute - baseline.completionMinute)
  const pct = Math.min(100, minute / model.durationMinutes * 100)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setMinute(m => {
      if (m >= model.durationMinutes) { setRunning(false); return m }
      return m + 1
    }), 65)
    return () => window.clearInterval(id)
  }, [running, model.durationMinutes])

  const run = () => {
    const m = parseScenario(text)
    if (m.attendees < 1 || m.organizers < 1 || m.desks < 1) { setError('MIRROR needs at least 1 attendee, organizer, and desk.'); return }
    setError(''); setChangeNote(''); setModel(m); setMinute(0); setRunning(true)
  }
  const applyChange = () => {
    const changed = applyWhatIf(model, whatIf)
    if (!changed || changed.attendees < 1 || changed.organizers < 1 || changed.desks < 1) {
      setError('Try a change like “increase attendees to 300” or “reduce organizers to 1”.')
      return
    }
    setError(''); setRunning(false); setMinute(0); setModel(changed)
    setText(`School event with ${changed.attendees} attendees, ${changed.organizers} organizers, ${changed.desks} registration desks, ${Math.round(changed.durationMinutes / 60)} hours.`)
    setChangeNote(`Applied: ${whatIf.trim()}`); setWhatIf('')
  }
  const reset = () => { setRunning(false); setMinute(0); setError(''); setChangeNote('') }

  return <main className="shell">
    <header className="top"><div className="brand"><div className="mark">M</div><strong>MIRROR</strong></div><div className="status"><i className="dot"/> {running ? 'simulation running' : minute >= model.durationMinutes ? 'simulation complete' : 'engine ready'}</div></header>
    <section className="hero"><div className="eyebrow">Decision simulation engine</div><h1>Test the decision<br/><span>before reality does.</span></h1><p>Describe a situation. MIRROR builds a model, executes its rules, and shows what changes when the plan is stressed.</p></section>

    <section className="workspace">
      <aside className="panel input-panel"><div className="label">01 / Scenario</div><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} aria-label="Scenario description"/><div className="actions"><button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run simulation'}</button><button className="secondary" onClick={reset}>Reset</button></div>{error && <div className="error">{error}</div>}
        <button className="demo" onClick={() => setText(demo)}><span>TRY THE DEMO</span><b>School event</b><small>200 attendees · 3 organizers · 2 desks · 2h · staff loss halfway</small></button>
        <div className="extracted"><div className="label">Model extracted</div><div className="chips"><span>{fmt(model.attendees)} attendees</span><span>{model.organizers} organizers</span><span>{model.desks} desks</span><span>{Math.round(model.durationMinutes / 60)}h</span>{model.lossAt !== null && <span>−1 staff @ {clock(model.lossAt)}</span>}</div></div>
      </aside>

      <section className="panel sim"><div className="simhead"><div><div className="label">02 / Live simulation</div><div className="simtitle">Registration system</div><div className="sub">Every minute is a state transition. The output is computed, not generated.</div></div><div className={`clock ${running ? 'live' : ''}`}><i/>{clock(minute)}<span>/ {clock(model.durationMinutes)}</span></div></div>
        <div className="metrics"><div className={`metric ${state.queue > 0 ? 'attention' : ''}`}><span>Waiting now</span><b>{fmt(state.queue)}</b><small>people</small></div><div className="metric"><span>Processed</span><b>{fmt(state.served)}</b><small>of {fmt(model.attendees)}</small></div><div className="metric"><span>Capacity</span><b>{state.capacityPerMinute}<em>/min</em></b><small>current throughput</small></div><div className={`metric ${eventActive ? 'attention' : ''}`}><span>Staff</span><b>{state.workers}/{model.organizers}</b><small>{eventActive ? '1 organizer unavailable' : 'all organizers active'}</small></div></div>

        <div className="stage"><div className="stage-head"><span>LIVE SYSTEM STATE</span><span className={eventActive ? 'danger' : ''}>{eventActive ? `STAFF LOSS · ${clock(model.lossAt ?? 0)}` : 'NORMAL OPERATION'}</span></div><div className="system">
          <div className="entity-block"><div className="entity-icon">{fmt(state.arrivals)}</div><strong>ARRIVALS</strong><small>{fmt(Math.max(0, state.arrivals - (states[minute - 2]?.arrivals ?? 0)))} this minute</small></div>
          <div className="connector"><i/><i/><i/></div>
          <div className={`entity-block queue-node ${state.queue > 0 ? 'hot' : ''}`}><div className="entity-icon">{fmt(state.queue)}</div><strong>QUEUE</strong><small>{state.queue > 0 ? 'pressure building' : 'clear'}</small></div>
          <div className="connector"><i/><i/><i/></div>
          <div className={`entity-block ${eventActive ? 'hot' : ''}`}><div className="staff-stack">{Array.from({length: model.organizers}, (_, i) => <i key={i} className={i < state.workers ? 'on' : 'off'}/>)}</div><strong>REGISTRATION</strong><small>{state.capacityPerMinute}/min capacity</small></div>
        </div><div className="event-strip"><span className={minute >= Math.min(30, model.durationMinutes) ? 'passed' : ''}>01 <b>Arrival wave</b> first 25%</span>{model.lossAt !== null && <span className={eventActive ? 'passed' : ''}>02 <b>Organizer leaves</b> {clock(model.lossAt)}</span>}<span>03 <b>Completion</b> {summary.completionMinute >= model.durationMinutes ? 'at window end' : clock(summary.completionMinute)}</span></div></div>

        <div className="progress"><span style={{width: `${pct}%`}}/></div>
        <div className="insight"><div className="insight-kicker">THE CONSEQUENCE</div><strong>{summary.peakQueue > 0 ? `The disruption creates a peak queue of ${fmt(summary.peakQueue)}.` : 'The modeled system absorbs the arrival wave.'}</strong><p>{delay > 0 ? `With one organizer lost at ${clock(model.lossAt ?? 0)}, completion moves ${delay} simulated minutes later than the baseline.` : 'No completion delay appears under the current assumptions.'}</p></div>

        <div className="change-box"><div><div className="label">WHAT IF?</div><strong>Change one condition and rerun the model.</strong><small>Try “increase attendees to 300”, “reduce organizers to 1”, or “increase desks to 4”.</small></div><div className="change-row"><input value={whatIf} onChange={e => setWhatIf(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyChange() }} placeholder="e.g. increase attendees to 300" aria-label="What if change"/><button className="secondary" onClick={applyChange}>Apply change</button></div>{changeNote && <div className="change-note">{changeNote} · Run simulation to watch the new state unfold.</div>}</div>
      </section>
    </section>

    <section className="analysis"><div className="section-head"><div><div className="label">03 / Decision impact</div><h2>See the consequence, not just the number.</h2></div><span className="badge">DETERMINISTIC OUTPUT</span></div><div className="analysis-grid">
      <div className="panel chart-card"><div className="card-title"><div><strong>Queue pressure</strong><small>How waiting changes throughout the event</small></div><b>{fmt(summary.peakQueue)} <span>peak</span></b></div><LineChart states={states} minute={minute}/></div>
      <div className="panel result-card"><div className="card-title"><div><strong>Baseline vs disruption</strong><small>Same model, one changed condition</small></div></div><div className="compare"><div><span>DISRUPTED</span><b>{clock(summary.completionMinute)}</b><small>completion</small></div><div className="arrow">→</div><div><span>BASELINE</span><b>{clock(baseline.completionMinute)}</b><small>completion</small></div></div><div className="impact"><b>{delay > 0 ? `+${delay} min` : '0 min'}</b><span>completion impact</span></div><div className="decision">{summary.peakQueue > 0 ? <><b>Decision signal</b><p>Keep a backup organizer available during the arrival wave, or increase registration capacity before the event.</p></> : <><b>Decision signal</b><p>The current capacity is sufficient for the modeled arrival profile.</p></>}</div></div>
    </div></section>

    <section className="model"><div className="label">04 / Model transparency</div><div className="modelgrid"><div className="modelcard"><h3>Arrival profile</h3><p>70% of attendees arrive during the first 25% of the event. This creates a real load spike instead of spreading demand uniformly.</p></div><div className="modelcard"><h3>Capacity rule</h3><p>Each organizer processes 2 people/minute and each desk supports 3. Effective capacity is the lower of staff and desk capacity.</p></div><div className="modelcard"><h3>State rule</h3><p>Arrivals join the queue, capacity removes people from it, and resource events change the next state. No LLM is involved in these calculations.</p></div></div></section>
    <footer className="footer">Built with care by <strong>Koglesh R. Murugan</strong> · MIRROR</footer>
  </main>
}
