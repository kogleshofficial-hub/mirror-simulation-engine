export type SimulationMode = 'flow' | 'project' | 'capacity' | 'service'

export type SimulationModel = {
  mode: SimulationMode
  title: string
  subject: { label: string; count: number }
  resources: Array<{
    label: string
    count: number
    capacityPerMinute: number
  }>
  durationMinutes: number
  profile: 'steady' | 'front-loaded'
  events: Array<{
    minute: number
    type: 'remove_resource' | 'add_resource' | 'demand_change'
    amount: number
    target: 'resource' | 'subject'
    label: string
  }>
  assumptions: string[]
  limitations: string[]
}

export function validateSimulationModel(value: unknown): SimulationModel | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const subject = raw.subject as Record<string, unknown> | undefined
  const resources = Array.isArray(raw.resources) ? raw.resources : []
  if (!subject || typeof subject.label !== 'string') return null
  const subjectCount = Number(subject.count)
  const durationMinutes = Number(raw.durationMinutes)
  if (!Number.isFinite(subjectCount) || subjectCount < 0 || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return null
  const normalizedResources = resources.map(item => {
    const r = item as Record<string, unknown>
    return {
      label: String(r.label ?? 'resource').slice(0, 80),
      count: Math.max(0, Number(r.count) || 0),
      capacityPerMinute: Math.max(0, Number(r.capacityPerMinute) || 0),
    }
  }).filter(r => r.count >= 0 && r.capacityPerMinute >= 0)
  if (normalizedResources.length === 0) return null
  const mode = raw.mode
  const validModes: SimulationMode[] = ['flow', 'project', 'capacity', 'service']
  return {
    mode: validModes.includes(mode as SimulationMode) ? mode as SimulationMode : 'flow',
    title: String(raw.title ?? 'Simulation').slice(0, 120),
    subject: { label: String(subject.label).slice(0, 80), count: Math.max(0, subjectCount) },
    resources: normalizedResources,
    durationMinutes: Math.min(10080, Math.max(1, Math.round(durationMinutes))),
    profile: raw.profile === 'front-loaded' ? 'front-loaded' : 'steady',
    events: Array.isArray(raw.events) ? raw.events.map(event => {
      const e = event as Record<string, unknown>
      return {
        minute: Math.max(0, Math.round(Number(e.minute) || 0)),
        type: e.type === 'add_resource' || e.type === 'demand_change' ? e.type : 'remove_resource',
        amount: Math.max(0, Number(e.amount) || 0),
        target: e.target === 'subject' ? 'subject' : 'resource',
        label: String(e.label ?? 'Scenario event').slice(0, 120),
      }
    }).filter(e => e.minute <= durationMinutes).slice(0, 30) : [],
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String).slice(0, 12) : [],
    limitations: Array.isArray(raw.limitations) ? raw.limitations.map(String).slice(0, 12) : [],
  }
}
