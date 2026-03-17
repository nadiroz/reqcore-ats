<script setup lang="ts">
import { Calendar } from 'lucide-vue-next'

interface Props {
  id: string
  candidateFirstName: string
  candidateLastName: string
  candidateEmail: string
  score: number | null
  createdAt: string | Date
  status: string
  selected?: boolean
  hasInterview?: boolean
  pendingGate?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  hasInterview: false,
  pendingGate: null,
})

defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <button
    class="group flex w-full cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-all duration-150"
    :class="selected
      ? 'border-brand-300 dark:border-brand-700 bg-brand-50/70 dark:bg-brand-950/20 ring-2 ring-brand-500/30 dark:ring-brand-500/20 shadow-sm'
      : 'border-surface-200/80 dark:border-surface-700/60 bg-white dark:bg-surface-900 hover:border-surface-300 dark:hover:border-surface-600 hover:shadow-sm'"
    @click="$emit('click')"
  >
    <div class="flex items-start gap-2.5">
      <div
        class="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors"
        :class="selected
          ? 'bg-brand-500 text-white dark:bg-brand-600'
          : 'bg-surface-100 text-surface-600 group-hover:bg-brand-50 group-hover:text-brand-700 dark:bg-surface-800 dark:text-surface-300 dark:group-hover:bg-brand-950 dark:group-hover:text-brand-300'"
      >
        {{ getCandidateInitials(candidateFirstName, candidateLastName) }}
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-surface-900 dark:text-surface-100">
          {{ candidateFirstName }} {{ candidateLastName }}
        </p>
        <p class="truncate text-xs text-surface-500 dark:text-surface-400">
          {{ candidateEmail }}
        </p>
      </div>
    </div>
    <div class="flex items-center gap-2 pl-[42px]">
      <span
        v-if="score != null"
        class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
        :class="scoreBadgeClass(score)"
      >
        {{ score }} pts
      </span>
      <span class="text-[11px] text-surface-400 dark:text-surface-500">{{ timeAgo(createdAt) }}</span>
      <span
        v-if="hasInterview"
        class="inline-flex items-center text-warning-500 dark:text-warning-400"
        title="Interview scheduled"
      >
        <Calendar class="size-3" />
      </span>
      <span
        v-if="pendingGate"
        class="ml-auto inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-200 dark:ring-amber-800"
      >
        {{ pendingGate }}
      </span>
    </div>
  </button>
</template>
