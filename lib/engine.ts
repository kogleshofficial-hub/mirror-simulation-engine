export type Model = {
  subject: string
  subjectLabel: string
  subjectCount: number
  resource: string
  resourceLabel: string
  resourceCount: number
  capacityPerResource: number
  durationMinutes: number
  lossAt: number | null
  lossAmount: number
  lossTarget: string | null
  profile: 'front-loaded' | 'steady'
}

export type State = {
  minute: number
  resources: number
  capacityPerMinute: number
  arrivals: number
  completed: number
  queue: number
  utilization: number
  bottleneck: string
}

export type Summary = {
  completionMinute: number
  peakQueue: number
  totalCompleted: number
  averageWaitMinutes: number
  baselineCompletionMinute: number
  maxUtilization: number
  completionPercent: number
}

const clean = (value: string) => Number(value.replace(/,/g, ''))

const singular = (value: string) => value.replace(/ies$/i, 'y').replace(/s$/i, '')
const nice = (value: string) => value.replace(/[-_]/g, ' ').trim()

function firstMatch(text: string, patterns: RegExp[], fallback: number) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return Math.max(0, clean(match[1]))
  }
  return fallback
}

function findSubject(text: string) {
  const candidates = [
    /\d[\d,]*\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*)?)\s+(?:to|need|must|should|will|can|have|are|is|people|per)/i,
    /(?:for|handle|process|serve|deliver|build|complete|produce)\s+(?:around\s+|about\s+)?\d[\d,]*\s+([a-z][a-z-]*)/i,
    /\d[\d,]*\s*(?:people|users|customers|students|orders|tasks|items|units|tickets|requests|visitors)/i,
  ]
  for (const pattern of candidates) {
    const match = text.match(pattern)
    if (match?.[1]) return singular(nice(match[1]))
    if (match?.[0]) {
      const word = match[0].match(/\d[\d,]*\s+([a-z][a-z-]*)/i)?.[1]
      if (word) return singular(word)
    }
  }
  return 'work'
}

function findResource(text: string) {
  const patterns = [
    /\d[\d,]*\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*)?)\s+(?:and|with|available|on hand|working|workers?)/i,
    /(?:with|have|using|from)\s+\d[\d,]*\s+([a-z][a-z-]*)/i,
    /\d[\d,]*\s+(organizers?|staff|workers?|developers?|servers?|machines?|counters?|desks?|stations?|cashiers?|agents?|vehicles?|drivers?|rooms?|machines?|printers?|lanes?|teams?)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return singular(nice(match[1]))
  }
  return 'resource'
}

export function parseScenario(text: string): Model {
  const input = text.trim()
  const subject = findSubject(input)
  const resource = findResource(input)

  const subjectCount = firstMatch(input, [
    /(\d[\d,]*)\s*(?:people|users|customers|students|attendees|orders|tasks|items|units|tickets|requests|visitors|products|packages|deliveries|jobs|records)/i,
    /(?:around|about|approximately|roughly|total(?: of)?|need|handle|process|serve)\s+(\d[\d,]*)/i,
  ], 100)

  const resourceCount = firstMatch(input, [
    /(\d[\d,]*)\s+(?:organizers?|staff|workers?|developers?|servers?|machines?|counters?|desks?|stations?|cashiers?|agents?|vehicles?|drivers?|rooms?|printers?|lanes?|teams?)/i,
    /(?:with|have|using)\s+(\d[\d,]*)/i,
  ], 2)

  const hours = input.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)/i)
  const days = input.match(/(\d+(?:\.\d+)?)\s*(?:days?|day)/i)
  const minutes = input.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)/i)
  const durationMinutes = Math.max(15, Math.round(
    hours ? Number(hours[1]) * 60 : days ? Number(days[1]) * 24 * 60 : minutes ? Number(minutes[1]) : 120,
  ))

  const rateMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:per|\/|each)\s*(?:minute|min|hour|hr|day)/i)
  const capacityPerResource = rateMatch
    ? Math.max(0.25, Number(rateMatch[1]) * (/hour|hr/i.test(rateMatch[0]) ? 1 / 60 : /day/i.test(rateMatch[0]) ? 1 / 1440 : 1))
    : 2

  const lossMatch = input.match(/(?:loses?|lose|losing|leaves?|leaving|unavailable|removed|offline|fails?|failure|down|drops?)\s*(?:one|1|a|an)?/i)
  const lossAmount = firstMatch(input, [
    /(?:loses?|lose|losing|remove|removes?|offline|fails?|drops?)\s+(\d[\d,]*)/i,
  ], lossMatch ? 1 : 0)
  const lossAt = lossMatch ? Math.round(durationMinutes / 2) : null
  const lossTarget = lossMatch ? resource : null

  const profile = /(?:rush|surge|peak|busy|most|70%|front[- ]loaded|early|first\s+(?:quarter|25|third))/i.test(input)
    ? 'front-loaded'
    : 'steady'

  const subjectLabel = nice(subject || 'work')
  const resourceLabel = nice(resource || 'resource')
  return { subject, subjectLabel, subjectCount, resource, resourceLabel, resourceCount, capacityPerResource, durationMinutes, lossAt, lossAmount, lossTarget, profile }
}

function arrivalsAt(model: Model, minute: number) {
  if (minute <= 0) return 0
  if (model.profile === 'front-loaded') {
    const peakMinutes = Math.min(30, Math.max(15, Math.round(model.durationMinutes * 0.25)))
    if (minute <= peakMinutes) return Math.min(model.subjectCount, Math.ceil(model.subjectCount * 0.7 * minute / peakMinutes))
    const remaining = model.subjectCount * 0.3
    return Math.min(model.subjectCount, Math.ceil(model.subjectCount * 0.7 + remaining * (minute - peakMinutes) / Math.max(1, model.durationMinutes - peakMinutes)))
  }
  return Math.min(model.subjectCount, Math.ceil(model.subjectCount * minute / model.durationMinutes))
}

function activeResources(model: Model, minute: number, applyEvents: boolean) {
  if (!applyEvents || model.lossAt === null || minute < model.lossAt) return model.resourceCount
  return Math.max(0, model.resourceCount - model.lossAmount)
}

export function step(model: Model, minute: number, applyEvents = true): State {
  const states = simulate(model, applyEvents)
  if (minute <= 0) return { minute: 0, resources: model.resourceCount, capacityPerMinute: model.resourceCount * model.capacityPerResource, arrivals: 0, completed: 0, queue: 0, utilization: 0, bottleneck: model.resourceLabel }
  return states[Math.min(minute, states.length) - 1]
}

export function simulate(model: Model, applyEvents = true): State[] {
  const states: State[] = []
  let queue = 0
  let completed = 0
  for (let minute = 1; minute <= model.durationMinutes; minute += 1) {
    const arrivalsNow = arrivalsAt(model, minute) - arrivalsAt(model, minute - 1)
    const resources = activeResources(model, minute, applyEvents)
    const capacity = Math.max(0, resources * model.capacityPerResource)
    const available = queue + arrivalsNow
    const completedNow = Math.min(available, capacity)
    queue = available - completedNow
    completed += completedNow
    const utilization = capacity === 0 ? (arrivalsNow > 0 ? 100 : 0) : Math.min(100, Math.round((Math.min(available, capacity) / capacity) * 100))
    states.push({
      minute,
      resources,
      capacityPerMinute: Math.round(capacity * 100) / 100,
      arrivals: arrivalsAt(model, minute),
      completed: Math.round(completed * 100) / 100,
      queue: Math.round(queue * 100) / 100,
      utilization,
      bottleneck: queue > 0 ? model.resourceLabel : 'Demand',
    })
  }
  return states
}

export function summarize(model: Model): Summary {
  const states = simulate(model, true)
  const baseline = simulate({ ...model, lossAt: null, lossAmount: 0 }, false)
  const finished = states.find(s => s.completed >= model.subjectCount)
  const baselineFinished = baseline.find(s => s.completed >= model.subjectCount)
  const peakQueue = Math.max(0, ...states.map(s => s.queue))
  const totalCompleted = states.at(-1)?.completed ?? 0
  const maxUtilization = Math.max(0, ...states.map(s => s.utilization))
  const completionMinute = finished?.minute ?? model.durationMinutes
  const baselineCompletionMinute = baselineFinished?.minute ?? model.durationMinutes
  const averageWaitMinutes = totalCompleted === 0 ? 0 : Math.round((peakQueue / Math.max(1, totalCompleted)) * 10) / 10
  return { completionMinute, peakQueue, totalCompleted, averageWaitMinutes, baselineCompletionMinute, maxUtilization, completionPercent: Math.min(100, Math.round((totalCompleted / Math.max(1, model.subjectCount)) * 100)) }
}
