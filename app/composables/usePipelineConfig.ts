import { DEFAULT_PIPELINE_STAGES, computeTransitions } from '~~/shared/status-transitions'
import type { PipelineStage, PipelineConfig } from '~~/shared/status-transitions'

export type { PipelineStage, PipelineConfig }

interface PipelineConfigResponse {
  stages: PipelineStage[]
}

/**
 * Composable for reading and updating the org's pipeline stage configuration.
 */
export function usePipelineConfig() {
  const { data, status, error, refresh } = useFetch<PipelineConfigResponse>('/api/pipeline-config', {
    key: 'pipeline-config',
    headers: useRequestHeaders(['cookie']),
  })

  const stages = computed<PipelineStage[]>(() => data.value?.stages ?? DEFAULT_PIPELINE_STAGES)
  const isLoading = computed(() => status.value === 'pending')

  const terminalStages = computed(() => stages.value.filter(s => s.terminal).map(s => s.id))
  const activeStages = computed(() => stages.value.filter(s => !s.terminal))

  function stageLabel(id: string): string {
    const stage = stages.value.find(s => s.id === id)
    if (stage) return stage.label
    // Fallback: capitalize the raw ID
    return id.charAt(0).toUpperCase() + id.slice(1)
  }

  const transitions = computed(() => computeTransitions(stages.value))

  async function saveStages(newStages: PipelineStage[]) {
    await $fetch('/api/pipeline-config', {
      method: 'PATCH',
      body: { stages: newStages },
    })
    await refresh()
  }

  return {
    stages,
    activeStages,
    terminalStages,
    transitions,
    isLoading,
    error,
    refresh,
    stageLabel,
    saveStages,
  }
}
