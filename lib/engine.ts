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
  assumptions: string[]
  limitations: string[]
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
const nice = (value: string) => value.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
const subjectWords = /people|users|customers|students|attendees|orders|tasks|items|units|tickets|requests|visitors|products|packages|deliveries|jobs|records|patients|calls|cases|files|applications|transactions|guests|passengers|vehicles|appointments|messages|claims|documents|containers/i
const resourceWords = /organizers?|staff|workers?|developers?|engineers?|servers?|machines?|counters?|desks?|stations?|cashiers?|agents?|vehicles?|drivers?|rooms?|printers?|lanes?|teams?|resources?|operators?|reviewers?|inspectors?|technicians?|dispatchers?|clerks?|nurses?|doctors?|riders?|pickers?|packers?|seats?|registers?/i

function firstNumber(text: string, patterns: RegExp[], fallback: number) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return Math.max(0, clean(match[1]))
  }
  return fallback
}

function toMinutes(value: number, unit: string) {
  if (/week/i.test(unit)) return value * 10080
  if (/day/i.test(unit)) return value * 1440
  if (/hour|hr/i.test(unit)) return value * 60
  return value
}

function findSubject(text: string) {
  const match = text.match(new RegExp(`(\\d[\\d,]*)\\s*(${subjectWords.source})`, 'i'))
  if (match) return singular(match[2])
  const fallback = text.match(/(?:process|serve|handle|build|complete|deliver|produce|inspect|review|pack|ship)\s+(?:around\s+|about\s+|approximately\s+|roughly\s+)?\d[\d,]*\s+([a-z][a-z-]*)/i)?.[1]
  return fallback ? singular(fallback) : 'work'
}

function findResource(text: string) {
  const match = text.match(new RegExp(`\\d[\\d,]*\\s+(${resourceWords.source})`, 'i'))?.[1]
  if (match) return singular(nice(match))
  const generic = text.match(/(?:with|have|using|from|by)\s+\d[\d,]*\s+([a-z][a-z-]*)/i)?.[1]
  if (generic && !subjectWords.test(generic) && !/days?|hours?|minutes?/i.test(generic)) return singular(generic)
  return 'resource'
}

function parseDuration(text: string) {
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(weeks?|days?|hours?|hrs?|minutes?|mins?|min)/gi)]
  if (!matches.length) return 120
  const primary = matches.find(m => /(?:over|for|within|across|during)\s*$/i.test(text.slice(Math.max(0, (m.index ?? 0) - 8), m.index ?? 0))) ?? matches[0]
  return Math.min(10080, Math.max(15, Math.round(toMinutes(Number(primary[1]), primary[2]))))
}

function parseRate(text: string) {
  const direct = text.match(/(\d+(?:\.\d+)?)\s*(?:per|\/|each)\s*(minute|min|hour|hr|day)/i)
  if (direct) {
    const value = Math.max(0.01, Number(direct[1]))
    return /day/i.test(direct[2]) ? value / 1440 : /hour|hr/i.test(direct[2]) ? value / 60 : value
  }
  const every = text.match(/(?:one|1|a)\s+(?:[a-z][a-z-]*\s+)?(?:every)\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|hours?|hrs?|hr|days?)/i)
  if (every) return 1 / Math.max(1, toMinutes(Number(every[1]), every[2]))
  const compactEvery = text.match(/every\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|hours?|hrs?|hr|days?)/i)
  if (compactEvery) return 1 / Math.max(1, toMinutes(Number(compactEvery[1]), compactEvery[2]))
  return 2
}

function parseLoss(text: string, durationMinutes: number, resourceCount: number) {
  const clause = text.match(/(?:loses?|lose|losing|leaves?|leaving|unavailable|removed|offline|fails?|failure|down|drops?|breaks?|stop working|stops working)/i)
  if (!clause) return { lossAt: null, lossAmount: 0 }
  const before = text.slice(0, clause.index ?? 0)
  const explicitAmount = before.match(new RegExp(`(\\d[\\d,]*)\\s+(?:${resourceWords.source})`, 'i'))?.[1]
  const amount = explicitAmount ? clean(explicitAmount) : firstNumber(text, [/(?:loses?|lose|losing|remove|removes?|offline|fails?|drops?|breaks?)\s+(\d[\d,]*)/i], 1)
  const time = text.match(/(?:at|after|in)\s+(\d+(?:\.\d+)?)\s*(weeks?|days?|hours?|hrs?|minutes?|mins?|min)/i)
  const rawTime = time ? toMinutes(Number(time[1]), time[2]) : durationMinutes / 2
  return { lossAt: Math.max(1, Math.min(durationMinutes, Math.round(rawTime))), lossAmount: Math.max(1, Math.min(resourceCount, amount || 1)) }
}

function applyWhatIf(text: string, subjectCount: number, resourceCount: number, rate: number, durationMinutes: number) {
  const change = text.match(/(?:change|what\s*if|instead|then)\s*:\s*(.+)$/i)?.[1] ?? ''
  if (!change) return { subjectCount, resourceCount, rate, durationMinutes, changeApplied: null as string | null }
  let nextSubject = subjectCount, nextResources = resourceCount, nextRate = rate, nextDuration = durationMinutes
  let changeApplied: string | null = null

  const percent = change.match(/(increase|decrease|raise|reduce|drop)\s+(?:demand|volume|workload|load|throughput|capacity)\s+by\s+(\d+(?:\.\d+)?)\s*%/i)
  if (percent) {
    const factor = 1 + (/increase|raise/i.test(percent[1]) ? 1 : -1) * Number(percent[2]) / 100
    if (/throughput|capacity/i.test(percent[0])) nextRate = Math.max(0.01, rate * factor)
    else nextSubject = Math.max(0, Math.round(subjectCount * factor))
    changeApplied = percent[0]
  }

  const absolute = change.match(/(add|remove|increase|decrease|reduce|drop)\s+(\d[\d,]*)\s+([a-z][a-z-]*)/i)
  if (absolute && !percent) {
    const amount = clean(absolute[2])
    const noun = absolute[3]
    const direction = /add|increase/i.test(absolute[1]) ? 1 : -1
    if (subjectWords.test(noun)) nextSubject = Math.max(0, subjectCount + direction * amount)
    else if (resourceWords.test(noun)) nextResources = Math.max(0, resourceCount + direction * amount)
    changeApplied = absolute[0]
  }

  const duration = change.match(/(extend|increase|reduce|shorten|decrease)\s+(?:the\s+)?(?:day|duration|window|time)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*(weeks?|days?|hours?|hrs?|minutes?|mins?|min)/i)
  if (duration) {
    const amount = toMinutes(Number(duration[2]), duration[3])
    nextDuration = Math.min(10080, Math.max(15, Math.round(nextDuration + (/extend|increase/i.test(duration[1]) ? amount : -amount))))
    changeApplied = duration[0]
  }
  return { subjectCount: nextSubject, resourceCount: nextResources, rate: nextRate, durationMinutes: nextDuration, changeApplied }
}

export function parseScenario(text: string): Model {
  const input = text.trim()
  const subject = findSubject(input)
  const resource = findResource(input)
  const baseSubjectCount = firstNumber(input, [new RegExp(`(\\d[\\d,]*)\\s*(?:${subjectWords.source})`, 'i'), /(?:around|about|approximately|roughly|total(?: of)?|need|handle|process|serve|manage)\s+(\d[\d,]*)/i], 100)
  const baseResourceCount = firstNumber(input, [new RegExp(`(\\d[\\d,]*)\\s+(?:${resourceWords.source})`, 'i'), /(?:with|have|using)\s+(\d[\d,]*)/i], 2)
  const baseDuration = parseDuration(input)
  const baseRate = parseRate(input)
  const changed = applyWhatIf(input, baseSubjectCount, baseResourceCount, baseRate, baseDuration)
  const { lossAt, lossAmount } = parseLoss(input, changed.durationMinutes, changed.resourceCount)
  const profile = /(?:rush|surge|peak|busy|most|front[- ]loaded|opening wave|early|first\s+(?:quarter|25|third))/i.test(input) ? 'front-loaded' : 'steady'
  const assumptions: string[] = []
  if (!/\d+(?:\.\d+)?\s*(?:per|\/|each)\s*(?:minute|min|hour|hr|day)/i.test(input) && !/(?:one|1|a)\s+(?:[a-z][a-z-]*\s+)?every\s+\d+/i.test(input)) assumptions.push(`No throughput rate was stated; MIRROR uses a default of 2 ${nice(subject)}/min/resource.`)
  if (profile === 'front-loaded') assumptions.push('Demand is modeled as front-loaded because an early rush was indicated.')
  else assumptions.push('Demand is distributed steadily across the modeled window.')
  if (changed.changeApplied) assumptions.push(`What-if applied deterministically: ${changed.changeApplied}.`)
  return { subject, subjectLabel: nice(subject || 'work'), subjectCount: changed.subjectCount, resource, resourceLabel: nice(resource || 'resource'), resourceCount: changed.resourceCount, capacityPerResource: Math.max(0.01, Math.round(changed.rate * 100) / 100), durationMinutes: changed.durationMinutes, lossAt, lossAmount, lossTarget: lossAt === null ? null : resource, profile, assumptions, limitations: ['Deterministic calculation only: results follow the quantities, rates, timing and assumptions represented in the model. Real systems can differ when important variables are not modeled.'] }
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
  let queue = 0, completed = 0
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
  const totalQueueWork = states.reduce((sum, state) => sum + state.queue, 0)
  const averageWaitMinutes = totalCompleted === 0 ? 0 : Math.round((totalQueueWork / totalCompleted) * 10) / 10
  return { completionMinute, peakQueue, totalCompleted, averageWaitMinutes, baselineCompletionMinute, maxUtilization, completionPercent: Math.min(100, Math.round(totalCompleted / Math.max(1, model.subjectCount) * 100)) }
}
