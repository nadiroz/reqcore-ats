<script setup lang="ts">
import { GripVertical, Plus, Trash2, Pencil, Check, X } from 'lucide-vue-next'
import type { PipelineStage } from '~/composables/usePipelineConfig'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

useSeoMeta({
  title: 'Pipeline Settings — Reqcore',
})

const { stages, isLoading, saveStages } = usePipelineConfig()

// Local editable copy
const localStages = ref<PipelineStage[]>([])
const isDirty = ref(false)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

watch(stages, (val) => {
  if (!isDirty.value) {
    localStages.value = val.map(s => ({ ...s }))
  }
}, { immediate: true })

function markDirty() {
  isDirty.value = true
  saveError.value = null
}

// ── Inline label editing ──────────────────────────────────────────────

const editingId = ref<string | null>(null)
const editingLabel = ref('')

function startEdit(stage: PipelineStage) {
  editingId.value = stage.id
  editingLabel.value = stage.label
}

function commitEdit() {
  if (!editingId.value) return
  const stage = localStages.value.find(s => s.id === editingId.value)
  if (stage && editingLabel.value.trim()) {
    stage.label = editingLabel.value.trim()
    markDirty()
  }
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

// ── Add custom stage ──────────────────────────────────────────────────

const newStageName = ref('')
const showAddInput = ref(false)

function addStage() {
  const label = newStageName.value.trim()
  if (!label) return

  // Generate a stable ID from label
  const id = `stage_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now().toString(36)}`

  // Insert before terminal stages
  const firstTerminalIdx = localStages.value.findIndex(s => s.terminal)
  const insertAt = firstTerminalIdx >= 0 ? firstTerminalIdx : localStages.value.length

  localStages.value.splice(insertAt, 0, {
    id,
    label,
    terminal: false,
    builtin: false,
  })

  newStageName.value = ''
  showAddInput.value = false
  markDirty()
}

// ── Remove custom stage ───────────────────────────────────────────────

function removeStage(id: string) {
  const idx = localStages.value.findIndex(s => s.id === id)
  if (idx >= 0) {
    localStages.value.splice(idx, 1)
    markDirty()
  }
}

// ── Save ──────────────────────────────────────────────────────────────

async function save() {
  isSaving.value = true
  saveError.value = null
  try {
    await saveStages(localStages.value)
    isDirty.value = false
  } catch (err: any) {
    saveError.value = err?.data?.statusMessage ?? 'Failed to save pipeline config.'
  } finally {
    isSaving.value = false
  }
}

function discard() {
  localStages.value = stages.value.map(s => ({ ...s }))
  isDirty.value = false
  saveError.value = null
  editingId.value = null
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-surface-900 dark:text-surface-50">Pipeline Stages</h1>
      <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
        Rename stages, add custom stages between existing ones, or remove stages you added. Built-in stages cannot be removed.
      </p>
    </div>

    <div v-if="isLoading" class="text-sm text-surface-400 py-4">Loading…</div>

    <div v-else>
      <!-- Stage list -->
      <div class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 divide-y divide-surface-100 dark:divide-surface-800 mb-4">
        <div
          v-for="stage in localStages"
          :key="stage.id"
          class="flex items-center gap-3 px-4 py-3"
        >
          <!-- Drag handle placeholder -->
          <GripVertical class="size-4 text-surface-300 dark:text-surface-600 shrink-0" />

          <!-- Terminal badge or active dot -->
          <span
            class="size-2 rounded-full shrink-0"
            :class="stage.terminal
              ? (stage.id === 'rejected' ? 'bg-danger-400' : 'bg-success-500')
              : 'bg-brand-500'"
          />

          <!-- Label (inline edit or display) -->
          <div class="flex-1 min-w-0">
            <div v-if="editingId === stage.id" class="flex items-center gap-2">
              <input
                v-model="editingLabel"
                class="flex-1 rounded-lg border border-brand-300 dark:border-brand-700 bg-white dark:bg-surface-800 px-2 py-1 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                @keydown.enter="commitEdit"
                @keydown.escape="cancelEdit"
              />
              <button class="text-success-600 hover:text-success-700" @click="commitEdit">
                <Check class="size-4" />
              </button>
              <button class="text-surface-400 hover:text-surface-600" @click="cancelEdit">
                <X class="size-4" />
              </button>
            </div>
            <div v-else class="flex items-center gap-2">
              <span class="text-sm font-medium text-surface-800 dark:text-surface-100">{{ stage.label }}</span>
              <span v-if="stage.terminal" class="text-xs text-surface-400 dark:text-surface-500">(terminal)</span>
              <span v-if="!stage.builtin" class="text-xs text-brand-500 dark:text-brand-400">custom</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              class="p-1 rounded text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              title="Rename"
              @click="startEdit(stage)"
            >
              <Pencil class="size-3.5" />
            </button>
            <button
              v-if="!stage.builtin"
              class="p-1 rounded text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
              title="Remove"
              @click="removeStage(stage.id)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Add stage -->
      <div class="mb-6">
        <div v-if="showAddInput" class="flex items-center gap-2">
          <input
            v-model="newStageName"
            placeholder="Stage name (e.g. Technical Review)"
            class="flex-1 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
            @keydown.enter="addStage"
            @keydown.escape="showAddInput = false"
          />
          <button
            :disabled="!newStageName.trim()"
            class="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            @click="addStage"
          >
            Add
          </button>
          <button
            class="rounded-lg border border-surface-300 dark:border-surface-600 px-3 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
            @click="showAddInput = false"
          >
            Cancel
          </button>
        </div>
        <button
          v-else
          class="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
          @click="showAddInput = true"
        >
          <Plus class="size-4" />
          Add stage
        </button>
      </div>

      <!-- Save error -->
      <div v-if="saveError" class="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
        {{ saveError }}
      </div>

      <!-- Actions -->
      <div v-if="isDirty" class="flex items-center gap-2">
        <button
          :disabled="isSaving"
          class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="save"
        >
          {{ isSaving ? 'Saving…' : 'Save changes' }}
        </button>
        <button
          class="rounded-lg border border-surface-300 dark:border-surface-600 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          @click="discard"
        >
          Discard
        </button>
      </div>
    </div>
  </div>
</template>
