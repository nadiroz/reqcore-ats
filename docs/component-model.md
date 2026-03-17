# Component Model

How components are described, structured, and documented in reqcore.

---

## Three levels

Every component sits at one of three levels of description. Understanding which level you're at
determines what belongs in the component itself versus what belongs in the parent.

### Story

The component in isolation. Answers: what is this thing, what does it need, what does it emit.
The props/emits contract is the full surface area. No knowledge of routing, no API calls, no
global state. If you can render it with static props, it belongs here.

### Variant

A named snapshot of the component in a specific state. One variant per meaningful visual or
behavioral difference. Think of it as "the component when X is true."

Examples for a candidate card:

- Default (name, email, score, stage badge)
- Selected (highlighted border, expanded actions)
- Loading skeleton
- No score (score is optional, layout shouldn't break)
- Gate pending (amber badge indicating blocked stage)

Variants make implicit states explicit. If a state only exists in production data, it will break
in production. Name it.

### Scenario

A variant with workflow context. Answers: where in the user journey does this component appear,
what state does its parent provide when it enters, what events does it emit to advance the flow.

A scenario is not a separate artifact. It is a variant with a one-sentence description that
captures the workflow moment.

Example for `CandidateSlidePanel`:

> "Opens when a reviewer selects a candidate on the pipeline board. The parent determines
> available transitions based on the candidate's current stage and the pipeline config.
> This component surfaces those options and emits the chosen transition back. It owns no
> business logic."

That sentence, combined with the mocked props, is the complete scenario.

---

## When a component needs a scenario description

A component needs a scenario description when any of the following are true:

- It is only meaningful in a specific workflow step (not a general-purpose UI primitive)
- Its props only make sense when you know what the parent is doing
- It emits events that change application state outside itself
- It has a "entry condition" (what has to be true before it appears)

Pure presentational components (buttons, badges, form inputs, data tables) do not need scenarios.
They need clean variants.

---

## Props contract discipline

Components should receive exactly what they need to render, nothing more.

Good: `allowedTransitions: string[]` — the parent computed this from pipeline config and job state.
Bad: `jobId: string` — the component fetching its own data couples it to the API and breaks isolation.

If a component needs data that requires async work, that async work belongs in the parent or a
composable. The component receives the result.

---

## Emits over callbacks

Components emit named events with typed payloads. They do not receive functions as props.

```ts
// good
emit('transition', 'interview')

// avoid
props.onTransition('interview')
```

This keeps the component's contract declarative and makes the scenario legible from the template
where it is used.

---

## Composables and shared state

Composables (`usePipelineConfig`, `useJob`, `useNotifications`) encapsulate logic that multiple
components or pages need. They are not a replacement for props. If a component needs data from a
composable, consider whether that data should be resolved by the page and passed down instead.

The exception is truly global state (color mode, current org, auth session) where prop drilling
would be absurd.

---

## Naming

| Type | Convention | Example |
|------|-----------|---------|
| Presentational primitive | PascalCase noun | `StatusBadge`, `ScoreRing` |
| Feature component | Domain + noun | `PipelineCandidateCard`, `CandidateSlidePanel` |
| Layout component | Layout + noun | `AppTopBar`, `DashboardShell` |
| Page-level component | Route mirrors file | `pages/dashboard/jobs/[id]/index.vue` |

Feature components live in `components/` subdirectories grouped by domain (`pipeline/`, `jobs/`,
`candidates/`). Primitives live flat in `components/ui/` or are sourced from the design system.
