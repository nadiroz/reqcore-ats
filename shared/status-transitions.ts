/**
 * ─────────────────────────────────────────────
 * Status transition rules — single source of truth
 * ─────────────────────────────────────────────
 *
 * Defines allowed state transitions for jobs and applications.
 * Imported by both server (API validation) and client (UI rendering).
 *
 * If you need to add/remove a transition, change it HERE and both
 * sides stay in sync automatically.
 */

// ─── Pipeline stage types (shared client + server) ──────────────────

export interface PipelineStage {
  id: string
  label: string
  terminal: boolean
  builtin: boolean
}

export interface PipelineConfig {
  stages: PipelineStage[]
}

/**
 * Default pipeline stages used when no org-specific config exists.
 */
export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { id: 'new', label: 'New', terminal: false, builtin: true },
  { id: 'screening', label: 'Screening', terminal: false, builtin: true },
  { id: 'interview', label: 'Interview', terminal: false, builtin: true },
  { id: 'offer', label: 'Offer', terminal: false, builtin: true },
  { id: 'hired', label: 'Hired', terminal: true, builtin: true },
  { id: 'rejected', label: 'Rejected', terminal: true, builtin: true },
]

/**
 * Compute allowed status transitions from an ordered list of pipeline stages.
 * Each active (non-terminal) stage can advance to the next active stage.
 * The last active stage advances to "hired". Any active stage can reject.
 * "rejected" reverts to the first active stage.
 */
export function computeTransitions(stages: PipelineStage[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const activeStages = stages.filter(s => !s.terminal)
  const rejectedId = stages.find(s => s.id === 'rejected')?.id
  const hiredId = stages.find(s => s.id === 'hired')?.id

  for (let i = 0; i < activeStages.length; i++) {
    const transitions: string[] = []
    if (i < activeStages.length - 1) {
      transitions.push(activeStages[i + 1].id)
    } else if (hiredId) {
      transitions.push(hiredId)
    }
    if (rejectedId) transitions.push(rejectedId)
    result[activeStages[i].id] = transitions
  }

  if (hiredId) result[hiredId] = []
  if (rejectedId) {
    result[rejectedId] = activeStages.length > 0 ? [activeStages[0].id] : []
  }

  return result
}

// ─── Application status transitions (static fallback) ───────────────
/**
 * Static allowed transitions — used as fallback when org pipeline config is unavailable.
 * For orgs with custom pipeline, use computeTransitions(orgStages) instead.
 */
export const APPLICATION_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['screening', 'rejected'],
  screening: ['interview', 'rejected'],
  interview: ['offer', 'rejected'],
  offer: ['hired', 'rejected'],
  hired: [],
  rejected: ['new'],
}

// ─── Job status transitions ────────────────────────────────────────
/**
 * Allowed status transitions for jobs.
 * `archived` can be reverted to `draft` or `open`.
 */
export const JOB_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['open', 'archived'],
  open: ['closed', 'archived'],
  closed: ['open', 'archived'],
  archived: ['draft', 'open'],
}

// ─── Interview status transitions ──────────────────────────────────
/**
 * Allowed status transitions for interviews.
 * `completed` is terminal — no forward transitions.
 * `cancelled` and `no_show` can be rescheduled back to `scheduled`.
 */
export const INTERVIEW_STATUS_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: ['scheduled'],
  no_show: ['scheduled'],
}
