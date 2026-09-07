import type { SimulationModel } from './model'

export type SimulationState = {
  minute: number
  demand: number
  completed: number
  queue: number
  capacityPerMinute: number
  resources: number
  utilization: number
  activeEvents: string[]
}

export type SimulationSummary = {
  completionMinute: number
  baselineCompletionMinute: number
  peakQueue: number
  totalCompleted: number
  completionPercent: number
  maxUtilization: number
}

function demandAt(model: SimulationModel, minute: number) {
  if (minute <= 0) return 0
  if (model.profile === 'front-loaded') {
    const peak = Math.min(30, Math.max(10, Math.round(model.durationMinutes * 0.25)))
    if (minute <= peak) return Math.min(model.subject.count, Math.ceil(model.subject.count * 0.7 * minute / peak))
    return Math.min(model.subject.count, Math.ceil(model.subject.count * 0.7 + model.subject.count * 0.3 * (minute - peak) / Math.max(1, model.durationMinutes - peak)))
  }
  return Math.min(model.subject.count, Math.ceil(model.subject.count * minute / model.durationMinutes))
}

function resourceMultiplier(model: SimulationModel, minute: number, applyEvents: boolean) {
  let resources = model.resources.reduce((sum, r) => sum + r.count, 0)
  if (!applyEvents) return resources
  for (const event of model.events) {
    if (event.minute > minute || event.target !== 'resource') continue
    if (event.type === 'remove_resource') resources -= event.amount
    if (event.type === 'add_resource') resources += event.amount
  }
  return Math.max(0, resources)
}

function capacityAt(model: SimulationModel, minute: number, applyEvents: boolean) {
  let capacity = model.resources.reduce((sum, r) => sum + r.count * r.capacityPerMinute, 0)
  if (!applyEvents) return Math.max(0, capacity)
  for (const event of model.events) {
    if (event.minute > minute) continue
    if (event.target === 'resource') {
      const average = model.resources.length ? model.resources.reduce((sum, r) => sum + r.capacityPerMinute, 0) / model.resources.length : 0
      if (event.type === 'remove_resource') capacity -= event.amount * average
      if (event.type === 'add_resource') capacity += event.amount * average
    }
    if (event.target === 'subject' && event.type === 'demand_change') capacity = capacity
  }
  return Math.max(0, capacity)
}

export function simulate(model: SimulationModel, applyEvents = true): SimulationState[] {
  const states: SimulationState[] = []
  let queue = 0
  let completed = 0
  for (let minute = 1; minute <= model.durationMinutes; minute++) {
    const arrivals = demandAt(model, minute) - demandAt(model, minute - 1)
    const capacity = capacityAt(model, minute, applyEvents)
    const available = queue + arrivals
    const done = Math.min(available, capacity)
    queue = available - done
    completed += done
    const activeEvents = applyEvents ? model.events.filter(e => e.minute === minute).map(e => e.label) : []
    states.push({
      minute,
      demand: demandAt(model, minute),
      completed: Math.min(model.subject.count, completed),
      queue,
      capacityPerMinute: Math.round(capacity * 100) / 100,
      resources: resourceMultiplier(model, minute, applyEvents),
      utilization: capacity <= 0 ? (arrivals > 0 ? 100 : 0) : Math.min(100, Math.round(Math.min(available, capacity) / capacity * 100)),
      activeEvents,
    })
  }
  return states
}

export function summarize(model: SimulationModel): SimulationSummary {
  const states = simulate(model, true)
  const baseline = simulate(model, false)
  const finish = states.find(s => s.completed >= model.subject.count)
  const baselineFinish = baseline.find(s => s.completed >= model.subject.count)
  const totalCompleted = states.at(-1)?.completed ?? 0
  return {
    completionMinute: finish?.minute ?? model.durationMinutes,
    baselineCompletionMinute: baselineFinish?.minute ?? model.durationMinutes,
    peakQueue: Math.max(0, ...states.map(s => s.queue)),
    totalCompleted,
    completionPercent: Math.min(100, Math.round(totalCompleted / Math.max(1, model.subject.count) * 100)),
    maxUtilization: Math.max(0, ...states.map(s => s.utilization)),
  }
}
