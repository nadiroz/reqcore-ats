import type {
  AssessmentTemplateConfig,
  AssessmentScores,
  AssessmentStatus,
  AssessmentDecision,
} from '~~/shared/assessment-types'

export interface AssessmentSession {
  id: string
  applicationId: string
  templateId: string | null
  status: AssessmentStatus
  currentRound: number
  round1DueDate: string | null
  round2DueDate: string | null
  scores: AssessmentScores | null
  behavioralNotes: string | null
  overallScore: number | null
  decision: AssessmentDecision | null
  trainabilityNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface AssessmentTemplate {
  id: string
  jobId: string
  config: AssessmentTemplateConfig
  createdAt: string
  updatedAt: string
}

interface AssessmentResponse {
  data: AssessmentSession | null
  template: AssessmentTemplate | null
}

/**
 * Composable for managing an application's assessment session.
 */
export function useAssessment(applicationId: MaybeRefOrGetter<string | null | undefined>) {
  const resolvedId = computed(() => toValue(applicationId))

  const { data, status, refresh } = useFetch<AssessmentResponse>(
    () => resolvedId.value ? `/api/applications/${resolvedId.value}/assessment` : '',
    {
      key: computed(() => `assessment-${resolvedId.value}`).value,
      headers: useRequestHeaders(['cookie']),
      immediate: !!toValue(applicationId),
      watch: [resolvedId],
    },
  )

  const assessment = computed<AssessmentSession | null>(() => data.value?.data ?? null)
  const template = computed<AssessmentTemplate | null>(() => data.value?.template ?? null)
  const isLoading = computed(() => status.value === 'pending')

  async function startAssessment(opts?: { templateId?: string; round1DueDate?: string }) {
    const id = resolvedId.value
    if (!id) return
    await $fetch(`/api/applications/${id}/assessment`, {
      method: 'POST',
      body: { templateId: opts?.templateId, round1DueDate: opts?.round1DueDate },
    })
    await refresh()
  }

  async function saveScores(scores: Partial<AssessmentScores>) {
    const id = resolvedId.value
    if (!id) return
    await $fetch(`/api/applications/${id}/assessment`, {
      method: 'PATCH',
      body: { scores },
    })
    await refresh()
  }

  async function saveBehavioralNotes(notes: string | null) {
    const id = resolvedId.value
    if (!id) return
    await $fetch(`/api/applications/${id}/assessment`, {
      method: 'PATCH',
      body: { behavioralNotes: notes },
    })
    await refresh()
  }

  async function saveDecision(decision: AssessmentDecision, trainabilityNotes?: string | null) {
    const id = resolvedId.value
    if (!id) return
    await $fetch(`/api/applications/${id}/assessment`, {
      method: 'PATCH',
      body: { decision, trainabilityNotes: trainabilityNotes ?? null },
    })
    await refresh()
  }

  async function updateStatus(newStatus: AssessmentStatus) {
    const id = resolvedId.value
    if (!id) return
    await $fetch(`/api/applications/${id}/assessment`, {
      method: 'PATCH',
      body: { status: newStatus },
    })
    await refresh()
  }

  async function advanceToRound2() {
    const id = resolvedId.value
    if (!id) return
    await $fetch(`/api/applications/${id}/assessment`, {
      method: 'PATCH',
      body: { advanceToRound2: true },
    })
    await refresh()
  }

  return {
    assessment,
    template,
    isLoading,
    startAssessment,
    saveScores,
    saveBehavioralNotes,
    saveDecision,
    updateStatus,
    advanceToRound2,
    refresh,
  }
}
