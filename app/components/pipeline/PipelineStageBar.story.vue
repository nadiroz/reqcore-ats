<script setup lang="ts">
import PipelineStageBar from './PipelineStageBar.vue'

const defaultStages = [
  { id: 'new', label: 'New', type: 'active' as const, builtin: true, terminal: false },
  { id: 'screening', label: 'Screening', type: 'active' as const, builtin: true, terminal: false },
  { id: 'assessment_r1', label: 'Assessment R1', type: 'gate' as const, builtin: false, terminal: false },
  { id: 'interview', label: 'Interview', type: 'active' as const, builtin: true, terminal: false },
  { id: 'offer', label: 'Offer', type: 'active' as const, builtin: true, terminal: false },
  { id: 'hired', label: 'Hired', type: 'terminal' as const, builtin: true, terminal: true },
  { id: 'rejected', label: 'Rejected', type: 'terminal' as const, builtin: true, terminal: true },
]

const counts = {
  new: 16,
  screening: 8,
  assessment_r1: 3,
  interview: 4,
  offer: 2,
  hired: 5,
  rejected: 12,
}

const emptyCounts = {
  new: 0,
  screening: 0,
  assessment_r1: 0,
  interview: 0,
  offer: 0,
  hired: 0,
  rejected: 0,
}

const simpleStages = [
  { id: 'new', label: 'New', type: 'active' as const, builtin: true, terminal: false },
  { id: 'interview', label: 'Interview', type: 'active' as const, builtin: true, terminal: false },
  { id: 'hired', label: 'Hired', type: 'terminal' as const, builtin: true, terminal: true },
  { id: 'rejected', label: 'Rejected', type: 'terminal' as const, builtin: true, terminal: true },
]
</script>

<template>
  <Story title="Pipeline / PipelineStageBar" :layout="{ type: 'single', iframe: true }">
    <Variant title="Full pipeline with gate stage">
      <PipelineStageBar
        :stages="defaultStages"
        selected-stage="interview"
        :counts="counts"
      />
    </Variant>

    <Variant title="Empty pipeline">
      <PipelineStageBar
        :stages="defaultStages"
        selected-stage="new"
        :counts="emptyCounts"
      />
    </Variant>

    <Variant title="Simple pipeline (no gates)">
      <PipelineStageBar
        :stages="simpleStages"
        selected-stage="new"
        :counts="{ new: 5, interview: 2, hired: 1, rejected: 3 }"
      />
    </Variant>

    <Variant title="Gate stage selected">
      <PipelineStageBar
        :stages="defaultStages"
        selected-stage="assessment_r1"
        :counts="counts"
      />
    </Variant>
  </Story>
</template>
