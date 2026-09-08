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
  const match = text.match(/(\d[\d,]*)\s*(?:people|users|customers|students|attendees|orders|tasks|items|units|tickets|requests|visitors|products|packages|deliveries|jobs|records|patients|calls|cases|files|applications|transactions|guests|passengers|vehicles)/i)
  if (match) {
    const word = match[0].match(/\d[\d,]*\s+([a-z][a-z-]*)/i)?.[1]
    if (word) return singular(word)
  }
  const fallback = text.match(/(?:process|serve|handle|build|complete|deliver|produce|inspect|review|pack|ship)\s+(?:around\s+|about\s+|approximately\s+|roughly\s+)?\d[\d,]*\s+([a-z][a-z-]*)/i)?.[1]
  return fallback ? singular(fallback) : 'work'
}

function findResource(text: string) {
  const known = text.match(/\d[\d,]*\s+(organizers?|staff|workers?|developers?|engineers?|servers?|machines?|counters?|desks?|stations?|cashiers?|agents?|vehicles?|drivers?|rooms?|printers?|lanes?|teams?|resources?|operators?|reviewers?|support staff|inspectors?|technicians?|dispatchers?|clerks?|nurses?|doctors?)/i)?.[1]
  if (known) return singular(nice(known))
  const withResource = text.match(/(?:with|have|using|from|by)\s+\d[\d,]*\s+([a-z][a-z-]*)/i)?.[1]
  if (withResource && !/people|users|customers|students|attendees|orders|tasks|items|units|work|days?|hours?|minutes?/i.test(withResource)) return singular(withResource)
  return 'resource'
}

function parseDuration(text: string) {
  const weeks = text.match(/(\d+(?:\.\d+)?)\s*(?:weeks?|week)/i)
  const days = text.match(/(\d+(?:\.\d+)?)\s*(?:days?|day)/i)
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)/i)
  const minutes = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)/i)
  const raw = weeks ? Number(weeks[1]) * 10080 : days ? Number(days[1]) * 1440 : hours ? Number(hours[1]) * 60 : minutes ? Number(minutes[1]) : 120
  return Math.min(10080, Math.max(15, Math.round(raw)))
}

function parseRate(text: string) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:per|\/|each)\s*(?:minute|min|hour|hr|day)/i)
  if (!match) return 2
  const value = Math.max(0.01, Number(match[1]))
  if (/day/i.test(match[0])) return value / 1440
  if (/hour|hr/i.test(match[0])) return value / 60
  return value
}

function parseLoss(text: string, durationMinutes: number) {
  const lossMatch = text.match(/(?:loses?|lose|losing|leaves?|leaving|unavailable|removed|offline|fails?|failure|down|drops?|breaks?|absent)/i)
  if (!lossMatch) return { lossAt: null, lossAmount: 0 }
  const amount = firstMatch(text, [/(?:loses?|lose|losing|remove|removes?|offline|fails?|drops?|breaks?)\s+(\d[\d,]*)/i], 1)
  const time = text.match(/(?:at|after|in)\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?)/i)
  let lossAt = Math.round(durationMinutes / 2)
  if (time) {
    const n = Number(time[1])
    lossAt = /day/i.test(time[2]) ? n * 1440 : /hour|hr/i.test(time[2]) ? n * 60 : n
  }
  return { lossAt: Math.max(1, Math.min(durationMinutes, Math.round(lossAt))), lossAmount: Math.max(1, amount) }
}

export function parseScenario(text: string): Model {
  const input = text.trim()
  const subject = findSubject(input)
  const resource = findResource(input)
  const subjectCount = firstMatch(input, [
    /(\d[\d,]*)\s*(?:people|users|customers|students|attendees|orders|tasks|items|units|tickets|requests|visitors|products|packages|deliveries|jobs|records|patients|calls|cases|files|applications|transactions|guests|passengers|vehicles)/i,
    /(?:around|about|approximately|roughly|total(?: of)?|need|handle|process|serve|manage)\s+(\d[\d,]*)/i,
  ], 100)
  const resourceCount = firstMatch(input, [
    /(\d[\d,]*)\s+(?:organizers?|staff|workers?|developers?|engineers?|servers?|machines?|counters?|desks?|stations?|cashiers?|agents?|vehicles?|drivers?|rooms?|printers?|lanes?|teams?|resources?|operators?|reviewers?|support staff|inspectors?|technicians?|dispatchers?|clerks?|nurses?|doctors?)/i,
    /(?:with|have|using)\s+(\d[\d,]*)/i,
  ], 2)
  const durationMinutes = parseDuration(input)
  const rate = parseRate(input)
  const { lossAt, lossAmount } = parseLoss(input, durationMinutes)
  const profile = /(?:rush|surge|peak|busy|most|front[- ]loaded|opening wave|early|first\s+(?:quarter|25|third))/i.test(input) ? 'front-loaded' : 'steady'
  return { subject, subjectLabel: nice(subject || 'work'), subjectCount, resource, resourceLabel: nice(resource || 'resource'), resourceCount, capacityPerResource: Math.max(0.01, Math.round(rate * 100) / 100), durationMinutes, lossAt, lossAmount, lossTarget: lossAt === null ? null : resource, profile }
}

function arrivalsAt(model: Model, minute: number) {
  if (minute <= 0) return 0
  if (model.profile === 'front-loaded') {
    const peakMinutes = Math.min(30, Math.max(15, Math.round(model.durationMinutes * 0.25)))
    if (minute <= peakMinutes) return Math.min(model.subjectCount, Math.ceil(model.subjectCount * 0.7 * minute / peakMinutes))
    return Math.min(model.subjectCount, Math.ceil(model.subjectCount * 0.7 + model.subjectCount * 0.3 * (minute - peakMinutes) / Math.max(1, model.durationMinutes - peakMinutes)))
  }
  return Math.min(model.subjectCount, Math.ceil(model.subjectCount * minute / model.durationMinutes))
}

function activeResources(model: Model, minute: number, applyEvents: boolean) {
  if (!applyEvents || model.lossAt === null || minute < model.lossAt) return model.resourceCount
  return Math.max(0, model.resourceCount - model.lossAmount)
}

export function step(model: Model, minute: number, applyEvents = true): State {
  if (minute <= 0) return { minute: 0, resources: model.resourceCount, capacityPerMinute: model.resourceCount * model.capacityPerResource, arrivals: 0, completed: 0, queue: 0, utilization: 0, bottleneck: model.resourceLabel }
  return simulate(model, applyEvents)[Math.min(minute, model.durationMinutes) - 1]
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
    states.push({ minute, resources, capacityPerMinute: Math.round(capacity * 100) / 100, arrivals: arrivalsAt(model, minute), completed: Math.min(model.subjectCount, Math.round(completed * 100) / 100), queue: Math.round(queue * 100) / 100, utilization, bottleneck: queue > 0 ? model.resourceLabel : 'Demand' })
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
  return { completionMinute, peakQueue, totalCompleted, averageWaitMinutes, baselineCompletionMinute, maxUtilization, completionPercent: Math.min(100, Math.round(totalCompleted / Math.max(1, model.subjectCount) * 100)) }
}
