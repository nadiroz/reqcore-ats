// ─────────────────────────────────────────────
// Assessment Template (per job)
// ─────────────────────────────────────────────

export interface AssessmentTaskTemplate {
  label: string
  weight: number
  passCriteria: string[]
  failCriteria: string[]
}

export interface AssessmentRoundTemplate {
  label: string
  tasks: AssessmentTaskTemplate[]
}

export interface AssessmentTemplateConfig {
  rounds: AssessmentRoundTemplate[]
}

// ─────────────────────────────────────────────
// Assessment Scoring (per application)
// ─────────────────────────────────────────────

export interface TaskScore {
  score: number
  notes: string
}

export interface RoundScores {
  tasks: TaskScore[]
}

export interface AssessmentScores {
  round1?: RoundScores
  round2?: RoundScores
}

// ─────────────────────────────────────────────
// Assessment status lifecycle
// ─────────────────────────────────────────────

export type AssessmentStatus =
  | 'not_started'
  | 'round1_sent'
  | 'round1_submitted'
  | 'round1_evaluated'
  | 'round2_sent'
  | 'round2_submitted'
  | 'completed'

export type AssessmentDecision = 'hire' | 'no_hire' | 'borderline' | 'pending'
