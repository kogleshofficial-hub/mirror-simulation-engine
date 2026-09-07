'use client'

import { useEffect, useMemo, useState } from 'react'

type Model={attendees:number;organizers:number;desks:number;duration:number;lossAt:number|null}
const demo='I want to run a school event for around 200 students. I have 3 organizers, 2 registration desks, and about 2 hours. What happens if one organizer leaves halfway through?'
const clean=(value:string)=>Number(value.replace(/,/g,''))
function parse(text:string):Model{
 const n=(re:RegExp, fallback:number)=>{const m=text.match(re);return m?Math.max(0,clean(m[1])):fallback}
 const attendees=n(/(\d[\d,]*)\s*(?:students|attendees|people)/i,200)
 const organizers=n(/(\d[\d,]*)\s*(?:organizers|staff|workers)/i,3)
 const desks=n(/(\d[\d,]*)\s*(?:registration\s*)?(?:desks|counters|stations)/i,2)
 const duration=n(/(\d[\d,]*)\s*(?:hours|hrs|hr)/i,2)
 const loss=/leaves?|leaving|unavailable|gone|loses?|removed/i.test(text)?Math.round(duration*60/2):null
 return {attendees,organizers,desks,duration,lossAt:loss}
}
function result(model:Model, minute:number){
 let workers=model.organizers
 if(model.lossAt!==null&&minute>=model.lossAt) workers=Math.max(0,model.organizers-1)
 const capacity=Math.max(0,Math.min(workers,model.desks))*3
 const arrivals=Math.min(model.attendees,Math.ceil((model.attendees/(model.duration*60))*minute))
 const served=Math.min(arrivals,capacity*minute)
 const queue=Math.max(0,arrivals-served)
 const bottleneck=workers<=model.desks?'Organizers':'Registration desks'
 return {workers,capacity,queue,served,bottleneck}
}

export default function Home(){
 const [text,setText]=useState(demo),[model,setModel]=useState<Model>(()=>parse(demo)),[minute,setMinute]=useState(0),[running,setRunning]=useState(false),[error,setError]=useState('')
 const state=useMemo(()=>result(model,minute),[model,minute])
 useEffect(()=>{if(!running)return;const id=window.setInterval(()=>setMinute(m=>{if(m>=model.duration*60){setRunning(false);return m}return m+1}),80);return()=>window.clearInterval(id)},[running,model.duration])
 const run=()=>{const m=parse(text);if(m.attendees<=0){setError('Add at least one attendee.');return}if(m.organizers<=0||m.desks<=0){setError('Define at least one organizer and one registration desk.');return}if(m.duration<=0){setError('Define a positive duration.');return}setError('');setModel(m);setMinute(0);setRunning(true)}
 const reset=()=>{setRunning(false);setMinute(0);setError('')}
 const pct=Math.min(100,(minute/(model.duration*60))*100)
 return <main className="shell">
  <header className="top"><div className="brand"><div className="mark">M</div><strong>MIRROR</strong></div><div className="status"><i className="dot"/> deterministic engine ready</div></header>
  <section className="hero"><div className="eyebrow">Interactive simulation engine</div><h1>Test the decision<br/><span>before reality does.</span></h1><p>Describe a real situation in your own words. MIRROR turns it into a structured model, executes deterministic rules, and shows the consequences as the simulation unfolds.</p></section>
  <section className="workspace">
   <div className="panel input-panel"><div className="label">01 / Scenario</div><textarea className="textarea" value={text} onChange={e=>setText(e.target.value)} aria-label="Scenario description"/><div className="actions"><button className="primary" onClick={run} disabled={running}>{running?'Running…':'Run simulation'}</button><button className="secondary" onClick={reset}>Reset</button></div>{error&&<div className="error">{error}</div>}<div className="demo">TRY THE DEMO<button onClick={()=>setText(demo)}>School event · 200 attendees · 3 organizers · 2 desks</button></div><div className="demo"><span>MODEL EXTRACTED</span><br/>{model.attendees} attendees · {model.organizers} organizers · {model.desks} desks · {model.duration}h</div></div>
   <div className="panel sim"><div className="simhead"><div><div className="label">02 / Live model</div><div className="simtitle">Registration flow</div><div className="sub">State updates every simulated minute</div></div><div className="clock">{String(Math.floor(minute/60)).padStart(2,'0')}:{String(minute%60).padStart(2,'0')} / {String(model.duration).padStart(2,'0')}:00</div></div>
    <div className="metrics"><div className="metric"><span>Queue</span><b>{state.queue}</b></div><div className="metric"><span>Served</span><b>{state.served}</b></div><div className="metric"><span>Active staff</span><b>{state.workers}</b></div><div className="metric"><span>Bottleneck</span><b style={{fontSize:14}}>{state.bottleneck}</b></div></div>
    <div className="stage"><div className="grid"/><div className="flow"><div className="node"><strong>ATTENDEES</strong><small>{model.attendees}</small></div><div className="line"/><div className="node hot"><strong>QUEUE</strong><small>{state.queue}</small></div><div className="line"/><div className="node"><strong>REGISTER</strong><small>{state.capacity}/min</small></div></div>{running&&<div className="pulse" style={{left:`${18+pct*.55}%`,top:'49%'}}/>}</div>
    <div className="runbar"><span style={{width:`${pct}%`}}/></div>
    <div className="timeline"><div className="label">Simulation timeline</div><div className="track"><div className="event"><i/>Arrival</div><div className="rail"/><div className="event"><i/>Queue</div><div className="rail"/><div className="event"><i/>Resource change</div><div className="rail"/><div className="event"><i/>Completion</div></div></div>
    <div className="explain"><strong>Why this result?</strong> MIRROR calculates service capacity from active organizers and registration desks, applies arrivals over simulated time, then tracks the queue after each state transition. The worker change occurs once at the modeled event time.</div>
   </div>
  </section>
  <section className="model"><div className="label">03 / Engine primitives</div><div className="modelgrid"><div className="modelcard"><h3>Entities & resources</h3><p>Attendees, organizers and desks become explicit state variables instead of hidden assumptions.</p></div><div className="modelcard"><h3>Rules & transitions</h3><p>Capacity, arrivals and resource changes are executed by deterministic transitions, not generated outcomes.</p></div><div className="modelcard"><h3>Explainable outcomes</h3><p>Queues, throughput, bottlenecks and timing remain visible so you can inspect why the state changed.</p></div></div></section>
  <footer className="footer">Built with care by <strong>Koglesh R. Murugan</strong> · MIRROR</footer>
 </main>
}