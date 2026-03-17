<script setup lang="ts">
import { Upload, FileText, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-vue-next'
import type { UseUploadOptions } from '~/composables/useUpload'

const props = defineProps<{
  candidateId: string
  applicationId?: string
  /** Show as inline drop zone (default) or trigger-only button */
  variant?: 'inline' | 'button'
  /** Default doc type applied to all uploads in this area */
  defaultType?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'uploaded'): void
  (e: 'error', message: string): void
}>()

const uploadOpts: UseUploadOptions = {
  candidateId: computed(() => props.candidateId),
  applicationId: computed(() => props.applicationId),
  defaultType: props.defaultType,
  onComplete: () => emit('uploaded'),
  onError: (err) => emit('error', err.message),
}

const { files, isUploading, uploadProgress, upload } = useUpload(uploadOpts)

const isDragging = ref(false)
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput')

const ACCEPTED_TYPES = '.pdf,.doc,.docx'
const ACCEPTED_LABEL = 'PDF, DOC, DOCX up to 10 MB'

function openPicker() {
  fileInputRef.value?.click()
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  const selected = Array.from(input.files ?? [])
  if (selected.length) upload(selected)
  // Reset input so the same file can be re-selected
  input.value = ''
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  e.preventDefault()
  const dropped = Array.from(e.dataTransfer?.files ?? [])
  if (dropped.length) upload(dropped)
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  if (!(e.currentTarget as Element).contains(e.relatedTarget as Node)) {
    isDragging.value = false
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div class="space-y-2">
    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      :accept="ACCEPTED_TYPES"
      multiple
      class="sr-only"
      :disabled="disabled"
      @change="handleFileInput"
    />

    <!-- Inline drop zone -->
    <template v-if="variant !== 'button'">
      <button
        type="button"
        class="w-full rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200 cursor-pointer bg-transparent"
        :class="[
          isDragging
            ? 'border-brand-400 bg-brand-50/60 dark:border-brand-600 dark:bg-brand-950/20'
            : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 hover:bg-surface-50/60 dark:hover:bg-surface-800/30',
          disabled ? 'opacity-50 pointer-events-none' : '',
        ]"
        :disabled="disabled"
        @click="openPicker"
        @drop="handleDrop"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
      >
        <div class="flex flex-col items-center gap-2">
          <div
            class="flex items-center justify-center size-10 rounded-xl transition-colors"
            :class="isDragging
              ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-400 dark:text-surface-500'"
          >
            <Upload class="size-5" />
          </div>
          <div>
            <p class="text-sm font-medium text-surface-700 dark:text-surface-300">
              <span class="text-brand-600 dark:text-brand-400">Click to upload</span>
              or drag and drop
            </p>
            <p class="text-xs text-surface-400 dark:text-surface-500 mt-0.5">{{ ACCEPTED_LABEL }}</p>
          </div>
        </div>
      </button>
    </template>

    <!-- Button variant -->
    <template v-else>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors cursor-pointer shadow-sm"
        :disabled="disabled || isUploading"
        @click="openPicker"
      >
        <Loader2 v-if="isUploading" class="size-3.5 animate-spin text-brand-500" />
        <Upload v-else class="size-3.5" />
        {{ isUploading ? `Uploading… ${uploadProgress}%` : 'Upload file' }}
      </button>
    </template>

    <!-- Active upload list -->
    <TransitionGroup
      tag="div"
      class="space-y-2"
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-for="file in files"
        :key="file.id"
        class="flex items-center gap-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2.5"
      >
        <!-- File icon -->
        <div class="flex items-center justify-center size-8 rounded-lg bg-surface-100 dark:bg-surface-800 shrink-0">
          <FileText class="size-4 text-surface-500 dark:text-surface-400" />
        </div>

        <!-- File info + progress -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
              {{ file.name }}
            </p>
            <span class="text-xs text-surface-400 shrink-0">{{ formatSize(file.size) }}</span>
          </div>

          <!-- Progress bar -->
          <div v-if="file.status === 'uploading'" class="mt-1.5 h-1 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
            <div
              class="h-full rounded-full bg-brand-500 transition-all duration-300"
              :style="{ width: `${file.progress}%` }"
            />
          </div>

          <!-- Error message -->
          <p v-if="file.status === 'error'" class="mt-0.5 text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1">
            <AlertCircle class="size-3 shrink-0" />
            {{ file.error ?? 'Upload failed' }}
          </p>
        </div>

        <!-- Status icon -->
        <div class="shrink-0">
          <Loader2
            v-if="file.status === 'uploading'"
            class="size-4 text-brand-500 animate-spin"
          />
          <CheckCircle2
            v-else-if="file.status === 'complete'"
            class="size-4 text-success-500"
          />
          <AlertCircle
            v-else-if="file.status === 'error'"
            class="size-4 text-danger-500"
          />
          <X
            v-else
            class="size-4 text-surface-400 cursor-pointer hover:text-surface-600 dark:hover:text-surface-200"
          />
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>
