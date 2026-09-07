import type { SimulationModel } from './model'
import { validateSimulationModel } from './model'

const MODEL_ID = 'onnx-community/Qwen2.5-Coder-0.5B-Instruct'

type Generator = (messages: Array<{ role: 'system' | 'user'; content: string }>, options?: Record<string, unknown>) => Promise<unknown>

let generatorPromise: Promise<Generator> | null = null

const SYSTEM_PROMPT = `You are MIRROR's local scenario compiler. Convert the user's real-world description into ONLY one JSON object for a deterministic simulation engine.

JSON shape:
{"mode":"flow","title":"short title","subject":{"label":"thing being processed","count":100},"resources":[{"label":"resource","count":2,"capacityPerMinute":2}],"durationMinutes":120,"profile":"steady","events":[],"assumptions":[],"limitations":[]}

Rules:
- Extract only quantities and relationships supported by the user's text.
- Never pretend to predict the future.
- Convert hours to minutes and days to minutes.
- Convert rates per hour/day to per-minute rates.
- If a resource has no explicit rate, use 2 units/minute and state that assumption.
- A worker/person who leaves halfway through becomes a remove_resource event at half the duration.
- Rush/opening/most arrivals early means front-loaded; otherwise steady.
- Use up to 8 resources and 30 events.
- Keep numbers non-negative and duration at least 1 minute.
- If information is missing, make the smallest defensible assumption and disclose it.
- Return JSON only. No markdown. No explanation outside JSON.`

async function loadPipeline(pipeline: (task: 'text-generation', model: string, options?: Record<string, unknown>) => Promise<unknown>): Promise<Generator> {
  try {
    const pipe = await pipeline('text-generation', MODEL_ID, { dtype: 'q4', device: 'webgpu' }) as (messages: unknown, options?: unknown) => Promise<unknown>
    return (messages, options) => pipe(messages, options)
  } catch {
    const pipe = await pipeline('text-generation', MODEL_ID, { dtype: 'q4' }) as (messages: unknown, options?: unknown) => Promise<unknown>
    return (messages, options) => pipe(messages, options)
  }
}

async function getGenerator(): Promise<Generator> {
  if (!generatorPromise) {
    generatorPromise = import('@huggingface/transformers').then(({ pipeline }) => loadPipeline(pipeline as never))
  }
  return generatorPromise
}

function extractJson(value: unknown): unknown {
  const text = typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? String((value[0] as { generated_text?: unknown } | undefined)?.generated_text ?? '')
      : String((value as { generated_text?: unknown } | undefined)?.generated_text ?? '')

  const clean = text.replace(/```json|```/gi, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(clean.slice(start, end + 1)) } catch { return null }
}

export async function compileWithLocalAI(text: string): Promise<SimulationModel> {
  const generator = await getGenerator()
  const result = await generator([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: text.slice(0, 12000) },
  ], {
    max_new_tokens: 700,
    do_sample: false,
    repetition_penalty: 1.05,
  })

  const parsed = extractJson(result)
  const model = validateSimulationModel(parsed)
  if (!model) throw new Error('Local AI returned an invalid simulation model')
  return model
}

export function localAIModelId() {
  return MODEL_ID
}
