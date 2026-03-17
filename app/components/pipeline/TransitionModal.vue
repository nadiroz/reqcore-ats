<script setup lang="ts">
const props = defineProps<{
  open: boolean
  targetStatus: string
  candidateName: string
  isTerminal: boolean
  requiresApproval: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm', note: string): void
  (e: 'request-approval', note: string): void
  (e: 'close'): void
}>()

const { stageLabel } = usePipelineConfig()

const note = ref('')
const isSubmitting = ref(false)

watch(() => props.open, (val) => {
  if (val) {
    note.value = ''
    isSubmitting.value = false
  }
})

function handleSubmit() {
  if (props.requiresApproval) {
    emit('request-approval', note.value.trim())
  } else {
    emit('confirm', note.value.trim())
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
      <div
        class="absolute inset-0 bg-black/40 backdrop-blur-sm"
        @click="!isTerminal && !requiresApproval && emit('close')"
      />
      <div class="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl ring-1 ring-surface-200/80 dark:ring-surface-700/60 p-6 max-w-sm w-full mx-4">
        <h3 class="text-base font-semibold text-surface-900 dark:text-surface-100 mb-1">
          {{ requiresApproval ? 'Request Approval' : `Move to ${stageLabel(targetStatus)}` }}
        </h3>

        <!-- Terminal warning -->
        <p
          v-if="isTerminal && !requiresApproval"
          class="mb-4 text-xs text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-950/40 rounded-lg px-3 py-2"
        >
          This is a terminal stage. The candidate will be marked as {{ stageLabel(targetStatus) }}.
        </p>

        <!-- Approval message -->
        <p v-else-if="requiresApproval" class="mb-4 text-sm text-surface-500 dark:text-surface-400">
          Moving <span class="font-medium text-surface-800 dark:text-surface-200">{{ candidateName }}</span>
          to <span class="font-medium text-surface-800 dark:text-surface-200">{{ stageLabel(targetStatus) }}</span>
          requires approval.
        </p>

        <!-- Standard message -->
        <p v-else class="mb-4 text-sm text-surface-500 dark:text-surface-400">
          Moving <span class="font-medium text-surface-800 dark:text-surface-200">{{ candidateName }}</span>.
        </p>

        <div class="mb-4">
          <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
            Note (optional{{ requiresApproval ? '' : ', added as a comment' }})
          </label>
          <textarea
            v-model="note"
            rows="3"
            :placeholder="requiresApproval ? 'Why should this transition be approved?' : 'Add context about this transition\u2026'"
            class="w-full resize-none rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 placeholder:text-surface-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400/30 dark:border-surface-700 dark:bg-surface-800/60 dark:text-surface-200 dark:placeholder:text-surface-500"
          />
        </div>

        <div class="flex gap-2.5">
          <button
            v-if="!isTerminal || requiresApproval"
            class="cursor-pointer rounded-lg border border-surface-200 px-3.5 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 transition-colors"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            :disabled="isSubmitting"
            class="flex-1 cursor-pointer rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            :class="requiresApproval
              ? 'bg-warning-600 hover:bg-warning-700'
              : isTerminal
                ? 'bg-success-600 hover:bg-success-700'
                : 'bg-brand-600 hover:bg-brand-700'"
            @click="handleSubmit"
          >
            {{ requiresApproval
              ? 'Request Approval'
              : `Move to ${stageLabel(targetStatus)}`
            }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
