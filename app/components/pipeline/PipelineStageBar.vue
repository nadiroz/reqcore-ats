<script setup lang="ts">
import { CheckCircle2 } from 'lucide-vue-next'

const props = defineProps<{
  stages: Array<{ id: string; label: string; terminal: boolean; builtin: boolean; gate?: boolean }>
  selectedStage: string
  counts: Record<string, number>
}>()

const emit = defineEmits<{
  (e: 'select', stageId: string): void
}>()

const { stageColorClass } = usePipelineConfig()

const activeStages = computed(() => props.stages.filter(s => !s.terminal))
const terminalStages = computed(() => props.stages.filter(s => s.terminal))
</script>

<template>
  <div class="shrink-0 border-b border-surface-200/80 bg-white dark:border-surface-800/60 dark:bg-surface-900">
    <div class="flex items-center gap-0 overflow-x-auto px-5 py-3">
      <!-- Active + gate stages with connectors -->
      <template v-for="(stage, i) in activeStages" :key="stage.id">
        <!-- Gate stage: diamond node on connector -->
        <template v-if="stage.gate">
          <!-- Connector line before gate -->
          <div class="flex items-center shrink-0">
            <div class="w-4 h-px bg-surface-300 dark:bg-surface-600" />
          </div>
          <!-- Gate diamond -->
          <button
            class="relative flex shrink-0 cursor-pointer items-center justify-center transition-all duration-200 focus:outline-none"
            :class="selectedStage === stage.id
              ? 'z-10'
              : ''"
            @click="emit('select', stage.id)"
          >
            <div
              class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all duration-200"
              :class="selectedStage === stage.id
                ? 'border-amber-400 bg-amber-50 text-amber-800 shadow-sm ring-2 ring-amber-400/30 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/20'
                : 'border-amber-200/80 bg-amber-50/50 text-amber-700 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:border-amber-700'"
            >
              <CheckCircle2 class="size-3 shrink-0" />
              <span class="whitespace-nowrap">{{ stage.label }}</span>
              <span
                v-if="(counts[stage.id] ?? 0) > 0"
                class="inline-flex min-w-[16px] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-semibold tabular-nums bg-amber-200/60 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              >
                {{ counts[stage.id] ?? 0 }}
              </span>
            </div>
          </button>
          <!-- Connector line after gate -->
          <div class="flex items-center shrink-0">
            <div class="w-4 h-px bg-surface-300 dark:bg-surface-600" />
          </div>
        </template>

        <!-- Active stage: full button -->
        <template v-else>
          <!-- Connector between active stages (not before first) -->
          <div v-if="i > 0 && activeStages[i-1]?.type !== 'gate'" class="flex items-center shrink-0">
            <div class="w-6 h-px bg-surface-300 dark:bg-surface-600 relative">
              <div class="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[4px] border-l-surface-300 dark:border-l-surface-600 border-y-[3px] border-y-transparent" />
            </div>
          </div>

          <button
            class="relative flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 focus:outline-none"
            :class="selectedStage === stage.id
              ? 'bg-brand-50 text-brand-700 shadow-sm ring-2 ring-brand-300/40 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-700/30'
              : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800/60 dark:hover:text-surface-200'"
            @click="emit('select', stage.id)"
          >
            <span
              class="size-2 rounded-full shrink-0"
              :class="stageColorClass(stage.id, 'dot')"
            />
            <span class="whitespace-nowrap">{{ stage.label }}</span>
            <span
              class="inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors"
              :class="selectedStage === stage.id
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300'
                : 'bg-surface-100 text-surface-500 dark:bg-surface-800/80 dark:text-surface-400'"
            >
              {{ counts[stage.id] ?? 0 }}
            </span>
          </button>
        </template>
      </template>

      <!-- Separator before terminal stages -->
      <template v-if="terminalStages.length > 0">
        <div class="flex items-center shrink-0 mx-2">
          <div class="w-8 border-t border-dashed border-surface-300 dark:border-surface-600" />
        </div>

        <template v-for="(stage, i) in terminalStages" :key="stage.id">
          <div v-if="i > 0" class="w-2 shrink-0" />
          <button
            class="relative flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 focus:outline-none"
            :class="selectedStage === stage.id
              ? 'bg-surface-100 text-surface-700 shadow-sm ring-2 ring-surface-300/40 dark:bg-surface-800 dark:text-surface-200 dark:ring-surface-600/30'
              : 'text-surface-400 hover:bg-surface-50 hover:text-surface-600 dark:text-surface-500 dark:hover:bg-surface-800/40 dark:hover:text-surface-400'"
            @click="emit('select', stage.id)"
          >
            <span
              class="size-2 rounded-full shrink-0"
              :class="stageColorClass(stage.id, 'dot')"
            />
            <span class="whitespace-nowrap">{{ stage.label }}</span>
            <span
              class="inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums bg-surface-100 text-surface-400 dark:bg-surface-800/80 dark:text-surface-500"
            >
              {{ counts[stage.id] ?? 0 }}
            </span>
          </button>
        </template>
      </template>
    </div>
  </div>
</template>
