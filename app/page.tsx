'use client'

import { useEffect, useMemo, useState } from 'react'
import { parseScenario } from '../lib/engine'
import { simulate, summarize, type SimulationState } from '../lib/simulation'
import type { SimulationModel } from '../lib/model'

const examples = [
  { label: 'Retail', text: 'A shop expects 900 customers over 6 hours. There are 4 cashiers and each cashier serves 3 customers per minute.' },
  { label: 'Project', text: 'A team has 120 tasks to finish in 5 days. 6 developers each complete 1 task per hour. 2 developers become unavailable after 2 days.' },
  { label: 'Logistics', text: 'A warehouse needs to ship 1200 packages in 8 hours. It has 5 packing stations, each processing 4 packages per minute.' },
  { label: 'Service', text: 'A support desk receives 300 tickets over 10 hours. 3 agents resolve 1 ticket every 4 minutes. One agent leaves after 6 hours.' },
]

const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n)
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`

function buildModel(text: string): SimulationModel {
  const p = parseScenario(text)
  return {
    mode: 'flow', title: `${fmt(p.subjectCount)} ${p.subjectLabel}`,
    subject: { label: p.subjectLabel, count: p.subjectCount },
    resources: [{ label: p.resourceLabel, count: p.resourceCount, capacityPerMinute: p.capacityPerResource }],
    durationMinutes: p.durationMinutes, profile: p.profile,
    events: p.lossAt == null ? [] : [{ minute: p.lossAt, type: 'remove_resource', amount: Math.min(p.resourceCount, p.lossAmount || 1), target: 'resource', label: `${p.lossAmount || 1} ${p.resourceLabel} unavailable` }],
    assumptions: [p.capacityPerResource === 2 ? `No throughput rate was stated; MIRROR uses a transparent default of 2 ${p.subjectLabel}/min/resource.` : 'Throughput is taken from the stated rate and converted to minutes.', p.profile === 'front-loaded' ? 'Demand is modeled as front-loaded because an early rush was indicated.' : 'Demand is distributed steadily across the modeled window.'],
    limitations: ['MIRROR is a deterministic scenario calculation, not a forecast. Results depend on supplied quantities, rates, timing and assumptions.'],
  }
}

function Chart({ states, minute }: { states: SimulationState[]; minute: number }) {
  const width = 820, height = 210, pad = 28
  const max = Math.max(1, ...states.map(s => s.queue))
  const points = states.map((s, i) => `${pad + i / Math.max(1, states.length - 1) * (width - pad * 2)},${height - pad - s.queue / max * (height - pad * 2)}`).join(' ')
  const x = pad + Math.max(0, Math.min(states.length - 1, minute - 1)) / Math.max(1, states.length - 1) * (width - pad * 2)
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Queue pressure over time"><line x1={pad} x2={width-pad} y1={height-pad} y2={height-pad} className="axis"/><polyline points={points} className="chart-line"/><line x1={x} x2={x} y1={pad} y2={height-pad} className="cursor"/></svg><div className="chart-axis"><span>00:00</span><span>{clock(Math.round((states.at(-1)?.minute ?? 0) / 2))}</span><span>{clock(states.at(-1)?.minute ?? 0)}</span></div></div>
}

function initialModel() { return buildModel(examples[0].text) }

export default function Home() {
  const [text, setText] = useState(examples[0].text)
  const [model, setModel] = useState<SimulationModel>(initialModel)
  const [minute, setMinute] = useState(0)
  const [running, setRunning] = useState(false)
  const [whatIf, setWhatIf] = useState('')
  const [tab, setTab] = useState<'simulate' | 'how'>('simulate')
  const states = useMemo(() => simulate(model), [model])
  const summary = useMemo(() => summarize(model), [model])
  const baselineSummary = useMemo(() => summarize({ ...model, events: [] }), [model])
  const current = minute === 0 ? { minute: 0, demand: 0, completed: 0, queue: 0, capacityPerMinute: model.resources.reduce((a, r) => a + r.count * r.capacityPerMinute, 0), resources: model.resources.reduce((a, r) => a + r.count, 0), utilization: 0, activeEvents: [] as string[] } : states[Math.min(minute, states.length) - 1]
  const event = model.events.find(e => e.minute === minute)
  const completionDelta = summary.completionMinute - baselineSummary.completionMinute
  const recommendation = summary.peakQueue === 0 ? 'Capacity is sufficient under the stated assumptions. Stress-test higher demand, lower throughput or a shorter operating window.' : `Peak pressure reaches ${fmt(summary.peakQueue)} waiting ${model.subject.label}. Test more ${model.resources[0]?.label || 'resources'}, faster throughput, or a longer window.`

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setMinute(value => {
      if (value >= model.durationMinutes) { setRunning(false); return value }
      return value + 1
    }), 30)
    return () => window.clearInterval(id)
  }, [running, model.durationMinutes])

  function run(nextText = text) {
    const clean = nextText.trim()
    if (!clean) return
    setText(clean); setModel(buildModel(clean)); setMinute(0); setRunning(true)
  }
  function applyWhatIf() { if (!whatIf.trim()) return; run(`${text}. Change: ${whatIf.trim()}`); setWhatIf('') }
  function reset() { setText(examples[0].text); setModel(initialModel()); setMinute(0); setRunning(false); setWhatIf('') }

  return <main className="shell">
    <header className="top"><div className="brand"><div className="mark">M</div><div><strong>MIRROR</strong><small>DECISION SIMULATION ENGINE</small></div></div><div className="status"><i className="dot"/> 100% deterministic · no AI · no API key</div></header>
    <section className="hero"><div className="eyebrow">Decision intelligence without the black box</div><h1>See what a decision <span>changes.</span></h1><p>Turn a measurable real-world situation into a transparent simulation. MIRROR extracts quantities with explicit rules, calculates the system minute by minute, and shows where pressure builds.</p><div className="hero-proof"><span><b>01</b> Describe</span><span><b>02</b> Model</span><span><b>03</b> Simulate</span><span><b>04</b> Stress-test</span></div></section>
    <nav className="tabs" aria-label="MIRROR sections"><button className={tab === 'simulate' ? 'active' : ''} onClick={() => setTab('simulate')}>Simulator</button><button className={tab === 'how' ? 'active' : ''} onClick={() => setTab('how')}>How it works</button></nav>
    {tab === 'simulate' ? <>
      <section className="workspace"><aside className="panel input-panel"><div className="label">01 / Describe the situation</div><textarea className="textarea" value={text} onChange={e => setText(e.target.value)} aria-label="Scenario description" placeholder="Example: 500 orders arrive over 4 hours. I have 3 workers, each processing 2 orders per minute."/><div className="actions"><button className="primary" onClick={() => run()}>{running ? 'Restart simulation' : 'Run simulation'}</button><button className="secondary" onClick={reset}>Reset</button></div><div className="example-list"><div className="label">Try a scenario</div>{examples.map(example => <button key={example.label} className="demo" onClick={() => run(example.text)}><span>{example.label}</span><b>{example.text.split('.')[0]}</b><small>Load and simulate</small></button>)}</div><div className="trust"><span className="trust-mark">✓</span><div><b>No AI. No API. No hidden calls.</b><small>The compiler and simulation run from deterministic TypeScript rules in the browser.</small></div></div></aside>
      <section className="panel sim"><div className="simhead"><div><div className="label">02 / Live model</div><div className="simtitle">{model.title}</div><div className="sub">Same inputs + same rules = same result.</div></div><div className={`clock ${running ? 'live' : ''}`}><i/>{clock(minute)}<span>/ {clock(model.durationMinutes)}</span></div></div>
      <div className="metrics"><div className={`metric ${current.queue > 0 ? 'attention' : ''}`}><span>Queue</span><b>{fmt(current.queue)}</b><small>work waiting</small></div><div className="metric"><span>Completed</span><b>{fmt(current.completed)}</b><small>of {fmt(model.subject.count)}</small></div><div className="metric"><span>Throughput</span><b>{fmt(current.capacityPerMinute)}<em>/min</em></b><small>current capacity</small></div><div className={`metric ${event ? 'attention' : ''}`}><span>Utilization</span><b>{current.utilization}%</b><small>{event ? event.label : 'current load'}</small></div></div>
      <div className="stage"><div className="stage-head"><span>LIVE SYSTEM STATE</span><span className={event ? 'danger' : ''}>{event ? `EVENT · ${clock(event.minute)}` : 'NORMAL OPERATION'}</span></div><div className="system"><div className="entity-block"><div className="entity-icon">{fmt(current.demand)}</div><strong>DEMAND</strong><small>{model.subject.label} in system</small></div><div className="connector"><i/><i/><i/></div><div className={`entity-block ${current.queue > 0 ? 'hot' : ''}`}><div className="entity-icon">{fmt(current.queue)}</div><strong>PRESSURE</strong><small>{current.queue > 0 ? 'capacity is behind' : 'system is clear'}</small></div><div className="connector"><i/><i/><i/></div><div className="entity-block"><div className="staff-stack">{Array.from({length: Math.min(12, Math.max(1, Math.ceil(current.resources)))}, (_, i) => <i key={i} className={i < current.resources ? 'on' : 'off'}/>)}</div><strong>RESOURCES</strong><small>{fmt(current.resources)} active</small></div></div><div className="event-strip"><span><b>Demand</b>{model.profile === 'front-loaded' ? 'front-loaded' : 'steady'}</span>{model.events.map((e, i) => <span key={i} className={minute >= e.minute ? 'passed' : ''}><b>Event</b>{clock(e.minute)} · {e.label}</span>)}<span><b>Finish</b>{summary.completionPercent >= 100 ? clock(summary.completionMinute) : 'not reached'}</span></div></div>
      <div className="progress"><span style={{width: `${Math.min(100, minute / Math.max(1, model.durationMinutes) * 100)}%`}}/></div><div className="insight"><div className="insight-kicker">MODEL FINDING</div><strong>{summary.peakQueue > 0 ? `${fmt(summary.peakQueue)} ${model.subject.label} wait at peak pressure.` : 'The modeled system keeps pace with demand.'}</strong><p>{summary.completionPercent}% completes within the modeled window. This is a scenario calculation, not a prediction.</p></div>
      <div className="whatif"><div><div className="label">03 / Stress-test a decision</div><strong>Change one thing. Compare the consequence.</strong><small>Try “add 2 workers”, “remove 1 machine”, “increase demand by 30%”, or “extend the day by 2 hours”.</small></div><div className="change-row"><input value={whatIf} onChange={e => setWhatIf(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyWhatIf() }} placeholder="What should change?"/><button className="secondary" onClick={applyWhatIf}>Test change</button></div></div></section></section>
      <section className="analysis"><div className="section-head"><div><div className="label">04 / Decision impact</div><h2>Turn simulation into a decision.</h2></div><span className="badge">REPRODUCIBLE</span></div><div className="analysis-grid"><div className="panel chart-card"><div className="card-title"><div><strong>System pressure</strong><small>Queue size at every simulated minute</small></div><b>{fmt(summary.peakQueue)} <span>peak</span></b></div><Chart states={states} minute={minute}/></div><div className="panel result-card"><div className="card-title"><div><strong>Decision brief</strong><small>Computed from the current scenario</small></div></div><div className="decision-grid"><div><span>COMPLETION</span><b>{summary.completionPercent}%</b></div><div><span>PEAK QUEUE</span><b>{fmt(summary.peakQueue)}</b></div><div><span>MAX LOAD</span><b>{summary.maxUtilization}%</b></div><div><span>WAIT SIGNAL</span><b>{summary.averageWaitMinutes ? `${fmt(summary.averageWaitMinutes)}m` : 'low'}</b></div></div><div className="decision"><b>Recommended next move</b><p>{recommendation}</p></div>{completionDelta > 0 && <div className="delta">The modeled resource-loss event changes completion by up to <strong>{clock(completionDelta)}</strong> versus the no-event baseline when both finish within the window.</div>}</div></div></section>
      <section className="transparency"><div className="section-head"><div><div className="label">05 / Trust layer</div><h2>Nothing is hidden behind an AI answer.</h2></div></div><div className="modelgrid"><div className="modelcard"><span>01</span><h3>Deterministic compiler</h3><p>Numbers, units, durations, rates and simple events are extracted with explicit rules.</p></div><div className="modelcard"><span>02</span><h3>Deterministic engine</h3><p>Every minute moves demand through available capacity. Excess work becomes queue pressure.</p></div><div className="modelcard"><span>03</span><h3>Transparent assumptions</h3><p>{model.assumptions.join(' ')}</p></div><div className="modelcard"><span>04</span><h3>Honest boundaries</h3><p>{model.limitations.join(' ')}</p></div></div></section>
    </> : <section className="how panel"><div className="label">How MIRROR works</div><h2>From words to consequences.</h2><p className="lead">MIRROR does not pretend to know the future. It creates a measurable model from supplied inputs and calculates the consequences implied by those assumptions.</p><div className="how-grid"><div><span>01</span><h3>Extract</h3><p>Find quantities such as demand, resources, duration and throughput.</p></div><div><span>02</span><h3>Normalize</h3><p>Convert hours, days and rates into a consistent minute-based model.</p></div><div><span>03</span><h3>Simulate</h3><p>Advance the system minute by minute. Capacity serves available work; excess becomes queue.</p></div><div><span>04</span><h3>Stress-test</h3><p>Change an input and run it again to see how the consequence changes.</p></div></div><div className="formula"><b>The core accounting rule</b><code>new queue = old queue + new demand − completed work</code><small>Completed work cannot exceed available work or available capacity.</small></div><h3 className="faq-title">FAQ</h3><div className="faq"><details><summary>Is MIRROR using AI?</summary><p>No. The current application is intentionally 100% deterministic. There is no AI model, provider, or API key.</p></details><details><summary>Does MIRROR predict the future?</summary><p>No. It calculates consequences inside a defined scenario. Reality can differ when unmodeled factors change the system.</p></details><details><summary>What can I simulate?</summary><p>Measurable resource-constrained workflows such as service desks, warehouses, staffing, production, project throughput, queues and support operations.</p></details><details><summary>What if my scenario is vague?</summary><p>MIRROR uses transparent defaults where necessary. More precise quantities and rates produce a more precise model.</p></details><details><summary>Does it need a key or paid AI service?</summary><p>No. The simulator is designed to work without an AI provider, paid inference, or secret key.</p></details><details><summary>Is this a forecasting or safety tool?</summary><p>No. It is a decision-exploration tool. High-stakes decisions should use validated domain-specific models and real operational data.</p></details></div></section>}
    <footer className="footer"><strong>MIRROR</strong><span>Test the decision before reality does.</span><span>Built by <b>Koglesh R. Murugan</b></span></footer>
  </main>
}
