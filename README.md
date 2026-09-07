# MIRROR

### Test the decision before reality does.

MIRROR is an interactive real-world simulation engine. Describe a situation naturally, translate it into a structured model, then execute deterministic rules to visualize how the system changes over time.

## Why it exists

Most decision tools stop at advice. MIRROR focuses on consequences: entities, resources, capacity, queues, constraints, events and state transitions become visible parts of a model that can be inspected and rerun.

## Architecture

```text
Natural language
      ↓
Model extraction
      ↓
Structured simulation model
      ↓
Deterministic simulation engine
      ↓
State transitions
      ↓
Metrics + timeline + visualization
```

The core engine does not ask an LLM to invent each result. Given the same model and rules, it produces repeatable results. AI can later be connected as a parser for richer natural-language understanding; the simulation layer remains deterministic.

## Current prototype

The first vertical models event registration: attendees arrive over time, organizers and registration desks determine service capacity, queues form when demand exceeds capacity, and resource changes affect the evolving state.

The prototype intentionally keeps its supported rules explicit rather than pretending to model every real-world system.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Stack

- Next.js
- React
- TypeScript
- CSS
- Deterministic discrete-time simulation logic

## Product direction

MIRROR can grow from a focused event-flow model into a general simulation platform with reusable primitives for resources, rates, capacities, constraints, events, dependencies and metrics. A future API could expose the same engine to planning and operations software.

Potential product tiers include personal simulations, advanced scenario history, team collaboration and an engine/API offering. These are future directions, not claims of current revenue.

## Limitations

A simulation is only as useful as its model. MIRROR therefore aims to expose assumptions and supported rules rather than present simulated outcomes as certainty about the real world.

## Hackathon

Built for the LUMA Hackathon Fall 2026.

**MIRROR — Test the decision before reality does.**

Built by **Koglesh R. Murugan**.