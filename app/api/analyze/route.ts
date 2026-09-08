import { NextResponse } from 'next/server'
import { parseScenario } from '../../../lib/engine'

function compile(text: string) {
  const p = parseScenario(text)
  return {
    mode: 'flow' as const,
    title: `${p.subjectCount} ${p.subjectLabel}`,
    subject: { label: p.subjectLabel, count: p.subjectCount },
    resources: [{ label: p.resourceLabel, count: p.resourceCount, capacityPerMinute: p.capacityPerResource }],
    durationMinutes: p.durationMinutes,
    profile: p.profile,
    events: p.lossAt == null ? [] : [{ minute: p.lossAt, type: 'remove_resource' as const, amount: Math.min(p.resourceCount, p.lossAmount || 1), target: 'resource' as const, label: `${p.lossAmount || 1} ${p.resourceLabel} unavailable` }],
    assumptions: [p.capacityPerResource === 2 ? `No throughput rate was stated; MIRROR uses 2 ${p.subjectLabel}/min/resource as a transparent default.` : 'Throughput was converted from the rate stated in the scenario.'],
    limitations: ['This is a deterministic scenario calculation, not a prediction. Results depend on the supplied inputs and modeling assumptions.'],
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text) return NextResponse.json({ error: 'Scenario text is required.' }, { status: 400 })
    if (text.length > 12000) return NextResponse.json({ error: 'Scenario is too long. Keep it under 12,000 characters.' }, { status: 413 })
    return NextResponse.json({ model: compile(text), source: 'deterministic' })
  } catch {
    return NextResponse.json({ error: 'Unable to compile the scenario.' }, { status: 400 })
  }
}
