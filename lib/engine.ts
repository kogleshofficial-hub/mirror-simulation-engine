export type Model = {
  attendees: number
  organizers: number
  desks: number
  durationMinutes: number
  lossAt: number | null
}

export type State = {
  minute: number
  workers: number
  capacityPerMinute: number
  arrivals: number
  served: number
  queue: number
  bottleneck: 'Organizers' | 'Registration desks'
}

export type Summary = {
  completionMinute: number
  peakQueue: number
  totalServed: number
  averageWaitMinutes: number
  baselineCompletionMinute: number
}

export function parseScenario(text: string): Model {
  const number = (re: RegExp, fallback: number) => {
    const match = text.match(re)
    if (!match) return fallback
    return Math.max(0, Number(match[1].replace(/,/g, '')))
  }

  const attendees = number(/(\d[\d,]*)\s*(?:students|attendees|people)/i, 200)
  const organizers = number(/(\d[\d,]*)\s*(?:organizers|staff|workers)/i, 3)
  const desks = number(/(\d[\d,]*)\s*(?:registration\s*)?(?:desks|counters|stations)/i, 2)
  const hours = number(/(\d[\d,]*)\s*(?:hours|hrs|hr)/i, 2)
  const durationMinutes = Math.max(30, Math.round(hours * 60))
  const hasLoss = /leaves?|leaving|unavailable|gone|loses?|removed/i.test(text)
  const lossAt = hasLoss ? Math.round(durationMinutes / 2) : null

  return { attendees, organizers, desks, durationMinutes, lossAt }
}

function arrivalsAt(model: Model, minute: number) {
  if (minute <= 0) return 0
  const peakMinutes = Math.min(30, Math.max(15, Math.round(model.durationMinutes * 0.25)))
  const peakShare = 0.7
  if (minute <= peakMinutes) return Math.min(model.attendees, Math.ceil(model.attendees * peakShare * minute / peakMinutes))
  const remaining = model.attendees * (1 - peakShare)
  const tailMinutes = Math.max(1, model.durationMinutes - peakMinutes)
  return Math.min(model.attendees, Math.ceil(model.attendees * peakShare + remaining * (minute - peakMinutes) / tailMinutes))
}

export function step(model: Model, minute: number, applyEvents = true): State {
  const workers = applyEvents && model.lossAt !== null && minute >= model.lossAt
    ? Math.max(0, model.organizers - 1)
    : model.organizers
  const deskCapacity = model.desks * 3
  const staffCapacity = workers * 2
  const capacityPerMinute = Math.max(0, Math.min(deskCapacity, staffCapacity))
  const arrivals = arrivalsAt(model, minute)
  let served = 0
  let queue = 0

  for (let t = 1; t <= minute; t += 1) {
    const arrivalsNow = arrivalsAt(model, t) - arrivalsAt(model, t - 1)
    const workersNow = applyEvents && model.lossAt !== null && t >= model.lossAt ? Math.max(0, model.organizers - 1) : model.organizers
    const capNow = Math.max(0, Math.min(model.desks * 3, workersNow * 2))
    queue = Math.max(0, queue + arrivalsNow - capNow)
    const servedNow = Math.min(queue + capNow, queue + arrivalsNow) - queue
    served += Math.max(0, servedNow)
    queue = Math.max(0, queue - Math.max(0, capNow - arrivalsNow))
  }

  // Recompute from conservation of flow; this avoids rounding drift in the loop above.
  const totalArrivals = arrivals
  served = Math.max(0, totalArrivals - queue)
  const bottleneck = workers * 2 <= model.desks * 3 ? 'Organizers' : 'Registration desks'
  return { minute, workers, capacityPerMinute, arrivals: totalArrivals, served, queue, bottleneck }
}

export function simulate(model: Model, applyEvents = true): State[] {
  const states: State[] = []
  let queue = 0
  let served = 0
  for (let minute = 1; minute <= model.durationMinutes; minute += 1) {
    const arrivalsNow = arrivalsAt(model, minute) - arrivalsAt(model, minute - 1)
    const workers = applyEvents && model.lossAt !== null && minute >= model.lossAt ? Math.max(0, model.organizers - 1) : model.organizers
    const capacity = Math.max(0, Math.min(model.desks * 3, workers * 2))
    const available = queue + arrivalsNow
    const servedNow = Math.min(available, capacity)
    queue = available - servedNow
    served += servedNow
    states.push({ minute, workers, capacityPerMinute: capacity, arrivals: arrivalsAt(model, minute), served, queue, bottleneck: workers * 2 <= model.desks * 3 ? 'Organizers' : 'Registration desks' })
  }
  return states
}

export function summarize(model: Model): Summary {
  const states = simulate(model, true)
  const baseline = simulate({ ...model, lossAt: null }, false)
  const finished = states.find(s => s.served >= model.attendees)
  const peakQueue = Math.max(0, ...states.map(s => s.queue))
  const completionMinute = finished?.minute ?? model.durationMinutes
  const totalServed = states.at(-1)?.served ?? 0
  const averageWaitMinutes = totalServed === 0 ? 0 : Math.round((peakQueue / Math.max(1, totalServed)) * 10) / 10
  const baselineFinished = baseline.find(s => s.served >= model.attendees)?.minute ?? model.durationMinutes
  return { completionMinute, peakQueue, totalServed, averageWaitMinutes, baselineCompletionMinute: baselineFinished }
}
