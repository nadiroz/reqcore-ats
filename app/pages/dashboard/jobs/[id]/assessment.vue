<script setup lang="ts">
import { Plus, Trash2, GripVertical, Save, ChevronDown, ChevronUp } from 'lucide-vue-next'
import type { AssessmentTemplateConfig, AssessmentRoundTemplate, AssessmentTaskTemplate } from '~~/shared/assessment-types'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

const route = useRoute()
const jobId = route.params.id as string

const { job, status: fetchStatus } = useJob(jobId)

useSeoMeta({
  title: computed(() =>
    job.value ? `Assessment Template — ${job.value.title} — Reqcore` : 'Assessment Template — Reqcore',
  ),
})

// ─────────────────────────────────────────────
// Fetch existing template
// ─────────────────────────────────────────────

const { data: templateData, refresh: refreshTemplate } = useFetch<{ data: { id: string; config: AssessmentTemplateConfig } | null }>(
  `/api/jobs/${jobId}/assessment-template`,
  { headers: useRequestHeaders(['cookie']) },
)

const hasTemplate = computed(() => !!templateData.value?.data)

// ─────────────────────────────────────────────
// Local editable state
// ─────────────────────────────────────────────

function emptyTask(): AssessmentTaskTemplate {
  return { label: '', weight: 0, passCriteria: [], failCriteria: [] }
}

function emptyRound(label: string): AssessmentRoundTemplate {
  return { label, tasks: [emptyTask()] }
}

const rounds = ref<AssessmentRoundTemplate[]>([emptyRound('Round 1')])
const isDirty = ref(false)
const isSaving = ref(false)
const saveError = ref<string | null>(null)
const saveSuccess = ref(false)

// Expanded round index for accordion
const expandedRound = ref(0)

watch(templateData, (val) => {
  if (val?.data?.config?.rounds) {
    rounds.value = JSON.parse(JSON.stringify(val.data.config.rounds))
    isDirty.value = false
  }
}, { immediate: true })

function markDirty() {
  isDirty.value = true
  saveError.value = null
  saveSuccess.value = false
}

// ─────────────────────────────────────────────
// Round management
// ─────────────────────────────────────────────

function addRound() {
  rounds.value.push(emptyRound(`Round ${rounds.value.length + 1}`))
  expandedRound.value = rounds.value.length - 1
  markDirty()
}

function removeRound(idx: number) {
  if (rounds.value.length <= 1) return
  rounds.value.splice(idx, 1)
  if (expandedRound.value >= rounds.value.length) {
    expandedRound.value = rounds.value.length - 1
  }
  markDirty()
}

// ─────────────────────────────────────────────
// Task management
// ─────────────────────────────────────────────

function addTask(roundIdx: number) {
  rounds.value[roundIdx].tasks.push(emptyTask())
  markDirty()
}

function removeTask(roundIdx: number, taskIdx: number) {
  if (rounds.value[roundIdx].tasks.length <= 1) return
  rounds.value[roundIdx].tasks.splice(taskIdx, 1)
  markDirty()
}

// ─────────────────────────────────────────────
// Criteria management
// ─────────────────────────────────────────────

function addCriterion(roundIdx: number, taskIdx: number, type: 'pass' | 'fail') {
  const task = rounds.value[roundIdx].tasks[taskIdx]
  if (type === 'pass') task.passCriteria.push('')
  else task.failCriteria.push('')
  markDirty()
}

function removeCriterion(roundIdx: number, taskIdx: number, type: 'pass' | 'fail', critIdx: number) {
  const task = rounds.value[roundIdx].tasks[taskIdx]
  if (type === 'pass') task.passCriteria.splice(critIdx, 1)
  else task.failCriteria.splice(critIdx, 1)
  markDirty()
}

// ─────────────────────────────────────────────
// Weight validation
// ─────────────────────────────────────────────

function totalWeight(roundIdx: number): number {
  return rounds.value[roundIdx].tasks.reduce((sum, t) => sum + (t.weight || 0), 0)
}

// ─────────────────────────────────────────────
// Save
// ─────────────────────────────────────────────

async function save() {
  isSaving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    const config: AssessmentTemplateConfig = { rounds: rounds.value }
    await $fetch(`/api/jobs/${jobId}/assessment-template`, {
      method: hasTemplate.value ? 'PATCH' : 'POST',
      body: { config },
    })
    await refreshTemplate()
    isDirty.value = false
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  }
  catch (err: any) {
    saveError.value = err?.data?.statusMessage ?? 'Failed to save template.'
  }
  finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-surface-900 dark:text-surface-50">Assessment Template</h1>
      <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
        Define rounds with weighted tasks and pass/fail criteria. This template is used for all candidate assessments on this job.
      </p>
    </div>

    <div v-if="fetchStatus === 'pending'" class="text-sm text-surface-400 py-4">Loading…</div>

    <div v-else>
      <!-- Rounds -->
      <div class="space-y-4 mb-6">
        <div
          v-for="(round, rIdx) in rounds"
          :key="rIdx"
          class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden"
        >
          <!-- Round header -->
          <button
            class="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
            @click="expandedRound = expandedRound === rIdx ? -1 : rIdx"
          >
            <div class="flex items-center gap-3">
              <GripVertical class="size-4 text-surface-300 dark:text-surface-600" />
              <input
                v-model="round.label"
                class="text-sm font-semibold text-surface-800 dark:text-surface-100 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                @input="markDirty"
                @click.stop
              />
              <span class="text-xs text-surface-400 dark:text-surface-500">
                {{ round.tasks.length }} {{ round.tasks.length === 1 ? 'task' : 'tasks' }}
                · {{ totalWeight(rIdx) }}% total weight
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="rounds.length > 1"
                class="p-1 rounded text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                title="Remove round"
                @click.stop="removeRound(rIdx)"
              >
                <Trash2 class="size-3.5" />
              </button>
              <ChevronDown v-if="expandedRound !== rIdx" class="size-4 text-surface-400" />
              <ChevronUp v-else class="size-4 text-surface-400" />
            </div>
          </button>

          <!-- Round body (expanded) -->
          <div v-if="expandedRound === rIdx" class="border-t border-surface-100 dark:border-surface-800 px-4 py-4 space-y-4">
            <div
              v-for="(task, tIdx) in round.tasks"
              :key="tIdx"
              class="rounded-lg border border-surface-100 dark:border-surface-800 p-4 space-y-3"
            >
              <div class="flex items-start gap-3">
                <div class="flex-1 space-y-2">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="task.label"
                      placeholder="Task name (e.g. Situation Assessment)"
                      class="flex-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-1.5 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                      @input="markDirty"
                    />
                    <div class="flex items-center gap-1">
                      <input
                        v-model.number="task.weight"
                        type="number"
                        min="0"
                        max="100"
                        class="w-16 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5 text-sm text-center text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                        @input="markDirty"
                      />
                      <span class="text-xs text-surface-400">%</span>
                    </div>
                  </div>

                  <!-- Pass criteria -->
                  <div>
                    <p class="text-xs font-medium text-success-600 dark:text-success-400 mb-1">Pass criteria</p>
                    <div v-for="(_, cIdx) in task.passCriteria" :key="`pass-${cIdx}`" class="flex items-center gap-1.5 mb-1">
                      <input
                        v-model="task.passCriteria[cIdx]"
                        placeholder="e.g. Identifies root cause"
                        class="flex-1 rounded border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-2 py-1 text-xs text-surface-700 dark:text-surface-300 placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        @input="markDirty"
                      />
                      <button class="text-surface-400 hover:text-danger-500 transition-colors" @click="removeCriterion(rIdx, tIdx, 'pass', cIdx)">
                        <Trash2 class="size-3" />
                      </button>
                    </div>
                    <button
                      class="text-[11px] text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium"
                      @click="addCriterion(rIdx, tIdx, 'pass')"
                    >+ Add pass criterion</button>
                  </div>

                  <!-- Fail criteria -->
                  <div>
                    <p class="text-xs font-medium text-danger-600 dark:text-danger-400 mb-1">Fail criteria</p>
                    <div v-for="(_, cIdx) in task.failCriteria" :key="`fail-${cIdx}`" class="flex items-center gap-1.5 mb-1">
                      <input
                        v-model="task.failCriteria[cIdx]"
                        placeholder="e.g. Unable to articulate approach"
                        class="flex-1 rounded border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-2 py-1 text-xs text-surface-700 dark:text-surface-300 placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        @input="markDirty"
                      />
                      <button class="text-surface-400 hover:text-danger-500 transition-colors" @click="removeCriterion(rIdx, tIdx, 'fail', cIdx)">
                        <Trash2 class="size-3" />
                      </button>
                    </div>
                    <button
                      class="text-[11px] text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium"
                      @click="addCriterion(rIdx, tIdx, 'fail')"
                    >+ Add fail criterion</button>
                  </div>
                </div>

                <button
                  v-if="round.tasks.length > 1"
                  class="p-1 rounded text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 transition-colors shrink-0 mt-1"
                  title="Remove task"
                  @click="removeTask(rIdx, tIdx)"
                >
                  <Trash2 class="size-3.5" />
                </button>
              </div>
            </div>

            <!-- Weight warning -->
            <p
              v-if="totalWeight(rIdx) !== 100 && round.tasks.some(t => t.weight > 0)"
              class="text-xs text-warning-600 dark:text-warning-400"
            >
              Weights total {{ totalWeight(rIdx) }}%. They should add up to 100%.
            </p>

            <button
              class="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium transition-colors"
              @click="addTask(rIdx)"
            >
              <Plus class="size-3.5" />
              Add task
            </button>
          </div>
        </div>
      </div>

      <!-- Add round -->
      <div class="mb-8">
        <button
          class="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
          @click="addRound"
        >
          <Plus class="size-4" />
          Add round
        </button>
      </div>

      <!-- Save error -->
      <div v-if="saveError" class="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
        {{ saveError }}
      </div>

      <!-- Save success -->
      <div v-if="saveSuccess" class="mb-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
        Template saved.
      </div>

      <!-- Actions -->
      <div v-if="isDirty" class="flex items-center gap-2">
        <button
          :disabled="isSaving"
          class="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="save"
        >
          <Save class="size-3.5" />
          {{ isSaving ? 'Saving…' : 'Save template' }}
        </button>
      </div>
    </div>
  </div>
</template>
