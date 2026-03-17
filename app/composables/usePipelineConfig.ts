import { DEFAULT_PIPELINE_STAGES, computeTransitions } from '~~/shared/status-transitions'
import type { PipelineStage, PipelineConfig, PipelineTransitionRule } from '~~/shared/status-transitions'

export type { PipelineStage, PipelineConfig, PipelineTransitionRule }

interface PipelineConfigResponse {
  stages: PipelineStage[]
  transitionRules?: PipelineTransitionRule[]
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
  const transitionRules = computed<PipelineTransitionRule[]>(() => data.value?.transitionRules ?? [])
  const isLoading = computed(() => status.value === 'pending')

  const terminalStages = computed(() => stages.value.filter(s => s.terminal).map(s => s.id))
  const activeStages = computed(() => stages.value.filter(s => !s.terminal))
  const gateStages = computed(() => stages.value.filter(s => s.gate && !s.terminal).map(s => s.id))

  function stageLabel(id: string): string {
    const stage = stages.value.find(s => s.id === id)
    if (stage) return stage.label
    return id.charAt(0).toUpperCase() + id.slice(1)
  }

  const transitions = computed(() => computeTransitions(stages.value))

  /**
   * Returns true if transitioning from → to requires an approval request.
   */
  function requiresApproval(from: string, to: string): boolean {
    return transitionRules.value.some(r => r.from === from && r.to === to && r.requiresApproval)
  }

  // ─── Stage color helpers ───────────────────────────────────────────

  const _dots = ['bg-brand-500', 'bg-info-500', 'bg-warning-500', 'bg-success-500']
  const _badges = [
    'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-800',
    'bg-info-50 text-info-700 ring-info-200 dark:bg-info-950/50 dark:text-info-300 dark:ring-info-800',
    'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-950/50 dark:text-warning-300 dark:ring-warning-800',
    'bg-success-50 text-success-700 ring-success-200 dark:bg-success-950/50 dark:text-success-300 dark:ring-success-800',
  ]

  function stageColorClass(stageId: string, variant: 'dot' | 'badge'): string {
    const allStages = stages.value
    const stage = allStages.find(s => s.id === stageId)
    const grey = variant === 'dot'
      ? 'bg-surface-400 dark:bg-surface-500'
      : 'bg-surface-100 text-surface-500 ring-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:ring-surface-700'
    if (!stage || stageId === 'rejected') return grey
    if (stage.terminal) {
      return variant === 'dot'
        ? 'bg-success-600 dark:bg-success-300'
        : 'bg-success-100 text-success-800 ring-success-300 dark:bg-success-900/50 dark:text-success-200 dark:ring-success-700'
    }
    const idx = allStages.filter(s => !s.terminal).findIndex(s => s.id === stageId) % 4
    return variant === 'dot' ? (_dots[idx] ?? grey) : (_badges[idx] ?? grey)
  }

  // ─── Save helpers ─────────────────────────────────────────────────

  async function saveStages(newStages: PipelineStage[]) {
    await $fetch('/api/pipeline-config', {
      method: 'PATCH',
      body: { stages: newStages },
    })
    await refresh()
  }

  async function saveConfig(config: { stages: PipelineStage[]; transitionRules?: PipelineTransitionRule[] }) {
    await $fetch('/api/pipeline-config', {
      method: 'PATCH',
      body: config,
    })
    await refresh()
  }

  return {
    stages,
    activeStages,
    terminalStages,
    gateStages,
    transitionRules,
    transitions,
    isLoading,
    error,
    refresh,
    stageLabel,
    stageColorClass,
    requiresApproval,
    saveStages,
    saveConfig,
  }
}
