# MIRROR

### See what a decision changes.

MIRROR is a deterministic decision-simulation engine for measurable, resource-constrained situations. A person describes a scenario in ordinary language; explicit parsing rules turn the measurable parts into a model; the local simulation engine executes that model minute by minute; the interface exposes the resulting state, queue pressure, bottlenecks and what-if consequences.

## The problem

Many everyday operational decisions are made with intuition or spreadsheets. The hard part is not only calculating an answer — it is seeing how a change propagates through a system over time.

MIRROR makes that consequence visible before the decision is made.

## What it does

```text
Situation in words
      ↓
Deterministic extraction
      ↓
Structured model
      ↓
Discrete-time simulation
      ↓
State + events + metrics
      ↓
What-if comparison
```

Example input:

> I have 200 students, 3 organizers, 2 registration desks, and 2 hours. What happens if one organizer leaves halfway through?

MIRROR extracts quantities, normalizes time and throughput, applies the event, then calculates the evolving queue and completion state.

## No AI. No API. No hidden inference.

The current product is intentionally 100% deterministic. It does **not** call an AI model or external inference service.

The same scenario and the same rules produce the same result. Assumptions and limitations are surfaced in the interface instead of being hidden behind a generated answer.

## Current supported model

The current engine focuses on a transparent single-flow model:

- one measurable work/demand population
- one resource pool
- per-resource throughput
- a finite simulation window
- steady or front-loaded demand
- timed resource-loss events
- deterministic what-if changes for resources, demand, throughput and duration
- queue, completion, utilization and waiting-pressure metrics

This is deliberately narrower than claiming to simulate every real-world system accurately.

## Core accounting rule

```text
new queue = old queue + new arrivals − completed work
```

Completed work is bounded by both available work and available capacity. Resource events change capacity at their specified simulation time.

## Why this is useful

MIRROR is designed for situations such as staffing, service operations, project throughput, event registration, warehouse processing and other workflows where demand competes with finite capacity.

It is a decision sandbox, not a prediction oracle: the output is only as valid as the quantities, rates, timing and assumptions represented in the model.

## Stack

- Next.js
- React
- TypeScript
- CSS
- Client-side deterministic simulation

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Competition

Built for the **LUMA Hackathon Fall 2026** as a functional technical project focused on real-world decision support through code.

## Product direction

The architecture is designed to grow toward reusable simulation primitives — multiple resource pools, sequential processes, dependencies, constraints, event schedules, scenario diffs, reproducible runs and eventually an engine/API layer. Those are future capabilities, not claims about the current prototype.

## Limitations

MIRROR does not know unprovided variables such as human behavior, random arrivals, failures that were not modeled, quality variation or domain-specific constraints. It reports deterministic consequences of the model rather than certainty about reality.

**MIRROR — See what a decision changes.**

Built by **Koglesh R. Murugan**.
