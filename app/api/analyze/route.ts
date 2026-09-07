import { NextResponse } from 'next/server'
import { parseScenario } from '../../../lib/engine'
import { validateSimulationModel } from '../../../lib/model'

const SYSTEM_PROMPT = `You are MIRROR's scenario compiler. Convert a user's natural-language real-world scenario into a deterministic simulation model. Do not predict the future and do not invent precise facts that the user did not provide.

MIRROR is strongest at measurable systems: queues, workflows, service operations, staffing, production, logistics, projects with throughput/capacity, and resource-constrained processes. For ambiguous scenarios, choose the simplest defensible model and state assumptions. If the scenario cannot be meaningfully simulated with available numbers, still extract the measurable core and explain what is missing.

Return ONLY valid JSON matching this exact shape:
{
  "mode":"flow|project|capacity|service",
  "title":"short scenario title",
  "subject":{"label":"thing being processed","count":100},
  "resources":[{"label":"resource","count":2,"capacityPerMinute":2}],
  "durationMinutes":120,
  "profile":"steady|front-loaded",
  "events":[{"minute":60,"type":"remove_resource|add_resource|demand_change","amount":1,"target":"resource|subject","label":"human-readable event"}],
  "assumptions":["explicit modeling assumption"],
  "limitations":["what this model does not represent"]
}

Rules:
- Preserve units conceptually. Convert hours to minutes and days to minutes.
- If a rate is given per hour/day, convert it to per minute.
- If a resource has no explicit capacity, use a conservative default of 2 units/minute and put that assumption in assumptions.
- Never fabricate an event merely because the scenario sounds stressful.
- For 'one worker leaves halfway through', create a remove_resource event at half the duration with amount 1.
- For front-loaded demand such as a rush, opening wave, peak, or most customers arriving early, use front-loaded; otherwise steady.
- Keep at most 8 resources and 30 events.
- Keep labels short and human-readable.
- Never include markdown fences.`

function deterministicFallback(text: string) {
  const base = parseScenario(text)
  return {
    mode: 'flow' as const,
    title: `${base.subjectCount} ${base.subjectLabel} simulation`,
    subject: { label: base.subjectLabel, count: base.subjectCount },
    resources: [{ label: base.resourceLabel, count: base.resourceCount, capacityPerMinute: base.capacityPerResource }],
    durationMinutes: base.durationMinutes,
    profile: base.profile,
    events: base.lossAt === null ? [] : [{ minute: base.lossAt, type: 'remove_resource' as const, amount: base.lossAmount || 1, target: 'resource' as const, label: `${base.lossAmount || 1} ${base.resourceLabel} unavailable` }],
    assumptions: ['This model was compiled without an AI provider; values were extracted by MIRROR’s deterministic fallback parser.'],
    limitations: ['Natural-language relationships that the fallback parser cannot identify are not represented.'],
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text) return NextResponse.json({ error: 'Scenario text is required.' }, { status: 400 })
    if (text.length > 12000) return NextResponse.json({ error: 'Scenario is too long. Keep it under 12,000 characters.' }, { status: 413 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ model: deterministicFallback(text), source: 'deterministic-fallback', warning: 'OPENAI_API_KEY is not configured.' })
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.MIRROR_AI_MODEL || 'gpt-5.6-luna',
        input: [
          { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
          { role: 'user', content: [{ type: 'input_text', text }] },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'mirror_simulation_model',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                mode: { type: 'string', enum: ['flow', 'project', 'capacity', 'service'] },
                title: { type: 'string' },
                subject: { type: 'object', additionalProperties: false, properties: { label: { type: 'string' }, count: { type: 'number' } }, required: ['label', 'count'] },
                resources: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { label: { type: 'string' }, count: { type: 'number' }, capacityPerMinute: { type: 'number' } }, required: ['label', 'count', 'capacityPerMinute'] } },
                durationMinutes: { type: 'number' },
                profile: { type: 'string', enum: ['steady', 'front-loaded'] },
                events: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { minute: { type: 'number' }, type: { type: 'string', enum: ['remove_resource', 'add_resource', 'demand_change'] }, amount: { type: 'number' }, target: { type: 'string', enum: ['resource', 'subject'] }, label: { type: 'string' } }, required: ['minute', 'type', 'amount', 'target', 'label'] } },
                assumptions: { type: 'array', items: { type: 'string' } },
                limitations: { type: 'array', items: { type: 'string' } },
              },
              required: ['mode', 'title', 'subject', 'resources', 'durationMinutes', 'profile', 'events', 'assumptions', 'limitations'],
            },
          },
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('MIRROR AI provider error:', response.status, detail.slice(0, 1000))
      return NextResponse.json({ model: deterministicFallback(text), source: 'deterministic-fallback', warning: 'AI analysis was unavailable, so MIRROR used its deterministic compiler.' })
    }

    const payload = await response.json()
    const outputText = typeof payload.output_text === 'string' ? payload.output_text : ''
    let parsed: unknown
    try { parsed = JSON.parse(outputText) } catch { parsed = null }
    const model = validateSimulationModel(parsed)
    if (!model) return NextResponse.json({ model: deterministicFallback(text), source: 'deterministic-fallback', warning: 'AI returned an invalid model, so MIRROR rejected it and used the deterministic compiler.' })

    return NextResponse.json({ model, source: 'ai' })
  } catch (error) {
    console.error('MIRROR analyze error:', error)
    return NextResponse.json({ error: 'Unable to analyze the scenario.' }, { status: 500 })
  }
}
