<script setup lang="ts">
import {
  UserRound, UserPlus, Pencil, Trash2, X, CheckCircle2,
} from 'lucide-vue-next'
import { z } from 'zod'
import draggable from 'vuedraggable'
import { usePreviewReadOnly } from '~/composables/usePreviewReadOnly'
import { JOB_STATUS_TRANSITIONS } from '~~/shared/status-transitions'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const jobId = route.params.id as string
const { handlePreviewReadOnlyError } = usePreviewReadOnly()
const { track } = useTrack()

// ─────────────────────────────────────────────
// Job data
// ─────────────────────────────────────────────

const { job: jobData, status: jobFetchStatus, error: jobError, refresh: refreshJob, updateJob, deleteJob } = useJob(jobId)

// ─────────────────────────────────────────────
// Applications data
// ─────────────────────────────────────────────

const {
  data: appData,
  status: appFetchStatus,
  error: appError,
  refresh: refreshApps,
} = useFetch('/api/applications', {
  key: `pipeline-apps-${jobId}`,
  query: { jobId, limit: 100 },
  headers: useRequestHeaders(['cookie']),
})

const {
  stages: pipelineStages,
  stageLabel,
  transitions: pipelineTransitions,
  stageColorClass,
  requiresApproval,
} = usePipelineConfig()

const applications = computed(() => appData.value?.data ?? [])

// ─────────────────────────────────────────────
// Board layout: columns grouped by stage
// ─────────────────────────────────────────────

const statusCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const s of pipelineStages.value) counts[s.id] = 0
  for (const app of applications.value) {
    counts[app.status] = (counts[app.status] ?? 0) + 1
  }
  return counts
})

const activeStages = computed(() => pipelineStages.value.filter((s: any) => !s.terminal))
const terminalStages = computed(() => pipelineStages.value.filter((s: any) => s.terminal))

// Group applications by their actual stage
const applicationsByStage = computed(() => {
  const groups: Record<string, typeof applications.value> = {}
  for (const s of pipelineStages.value) groups[s.id] = []
  for (const app of applications.value) {
    if (groups[app.status]) groups[app.status]!.push(app)
  }
  return groups
})

// ─────────────────────────────────────────────
// Drag-and-drop
// ─────────────────────────────────────────────

const isDragging = ref(false)
const dragGroups = reactive<Record<string, any[]>>({})

function syncDragGroups() {
  const groups = applicationsByStage.value
  for (const [key, apps] of Object.entries(groups)) {
    dragGroups[key] = [...apps]
  }
  for (const key of Object.keys(dragGroups)) {
    if (!(key in groups)) delete dragGroups[key]
  }
}

// Keep drag groups in sync with server data (only when not actively dragging)
watch(applicationsByStage, () => {
  if (!isDragging.value) syncDragGroups()
}, { immediate: true })

function onDragStart() {
  isDragging.value = true
}

function onDragEnd() {
  isDragging.value = false
}

function handleDragChange(evt: any, targetStageId: string) {
  if (!evt.added) return
  const movedItem = evt.added.element
  if (!movedItem || movedItem.status === targetStageId) {
    syncDragGroups()
    return
  }
  processDrop(movedItem, targetStageId)
}

async function processDrop(movedItem: any, targetStageId: string) {
  const stage = pipelineStages.value.find((s: any) => s.id === targetStageId)
  const isTerminal = stage?.terminal ?? false
  const needsApproval = requiresApproval(movedItem.status, targetStageId)

  if (isTerminal || needsApproval) {
    selectedApplicationId.value = movedItem.id
    openTransitionModal(targetStageId)
    await refreshApps()
    syncDragGroups()
    return
  }

  const previousStatus = movedItem.status
  isMutating.value = true
  try {
    await $fetch(`/api/applications/${movedItem.id}`, {
      method: 'PATCH',
      body: { status: targetStageId },
    })
    track('pipeline_stage_changed', { from_stage: previousStatus, to_stage: targetStageId })
    await refreshApps()

    if (undoTimer) clearTimeout(undoTimer)
    pendingUndo.value = { applicationId: movedItem.id, fromStatus: previousStatus, toStatus: targetStageId }
    undoTimer = setTimeout(() => { pendingUndo.value = null }, 8000)
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    statusError.value = err?.data?.statusMessage ?? 'Failed to move candidate'
    setTimeout(() => { statusError.value = null }, 6000)
    await refreshApps()
  } finally {
    isMutating.value = false
    syncDragGroups()
  }
}

// ─────────────────────────────────────────────
// Slide-in panel state
// ─────────────────────────────────────────────

const selectedApplicationId = ref<string | null>(null)
const panelOpen = computed(() => selectedApplicationId.value !== null)

const selectedApplication = computed(() => {
  if (!selectedApplicationId.value) return null
  return applications.value.find((a: any) => a.id === selectedApplicationId.value) ?? null
})

function selectCandidate(appId: string) {
  selectedApplicationId.value = appId
}

function closePanel() {
  selectedApplicationId.value = null
}

// ─────────────────────────────────────────────
// Application detail for slide-in panel
// ─────────────────────────────────────────────

type SwipeDocument = {
  id: string
  type: string
  originalFilename: string
  mimeType: string
  createdAt: string | Date
}

type SwipeApplicationDetail = {
  id: string
  status: string
  score: number | null
  notes: string | null
  createdAt: string | Date
  updatedAt: string | Date
  candidate: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    documents: SwipeDocument[]
  }
  responses: any[]
}

const {
  data: currentApplication,
  status: detailFetchStatus,
  execute: executeDetailFetch,
} = useFetch<SwipeApplicationDetail | null>(
  () => `/api/applications/${selectedApplicationId.value}`,
  {
    key: computed(() => `pipeline-application-${selectedApplicationId.value}`),
    immediate: false,
    headers: useRequestHeaders(['cookie']),
  },
)

const cachedApplication = ref<SwipeApplicationDetail | null>(null)

const resolvedCurrentApplication = computed(() => {
  if (currentApplication.value && currentApplication.value.id === selectedApplicationId.value) {
    return currentApplication.value
  }
  return cachedApplication.value
})

watch(currentApplication, (val) => {
  if (val && val.id === selectedApplicationId.value) {
    cachedApplication.value = val
  }
})

watch(selectedApplicationId, async (id: string | null) => {
  if (!id) return
  await executeDetailFetch()
}, { immediate: true })

// ─────────────────────────────────────────────
// Activity feed data
// ─────────────────────────────────────────────

const { tasks, createTask, toggleTask, deleteTask } =
  useApplicationTasks(selectedApplicationId)

const { comments, createComment, updateComment, deleteComment } = useComments({
  targetType: 'application',
  targetId: computed(() => selectedApplicationId.value || undefined),
})

const { data: activityLogData, refresh: refreshActivityLog } = useFetch('/api/activity-log', {
  key: computed(() => `activity-log-${selectedApplicationId.value}`),
  query: computed(() => ({
    resourceType: 'application',
    resourceId: selectedApplicationId.value,
    limit: 50,
  })),
  headers: useRequestHeaders(['cookie']),
  immediate: false,
})
watch(selectedApplicationId, (id) => { if (id) refreshActivityLog() }, { immediate: true })
const activityItems = computed(() => activityLogData.value?.data ?? [])

// ─────────────────────────────────────────────
// Candidate links
// ─────────────────────────────────────────────

const currentCandidateId = computed(() => resolvedCurrentApplication.value?.candidate.id)
const { links: candidateLinks } = useCandidateLinks(currentCandidateId)

// ─────────────────────────────────────────────
// Interviews
// ─────────────────────────────────────────────

const { data: jobInterviewsData, refresh: refreshJobInterviews } = useFetch<{ data: Interview[] }>('/api/interviews', {
  key: `pipeline-job-interviews-${jobId}`,
  query: { jobId, limit: 100 },
  headers: useRequestHeaders(['cookie']),
})

const jobInterviews = computed(() => jobInterviewsData.value?.data ?? [])

const currentApplicationInterviews = computed(() =>
  jobInterviews.value.filter(i => i.applicationId === selectedApplicationId.value),
)

const applicationsWithInterviews = computed(() =>
  new Set(jobInterviews.value.map(i => i.applicationId)),
)

// ─────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────

const allowedTransitions = computed(() => {
  if (!selectedApplication.value) return []
  return pipelineTransitions.value[selectedApplication.value.status] ?? []
})

const isMutating = ref(false)
const statusError = ref<string | null>(null)

// Transition modal
const transitionModal = ref<{ targetStatus: string; isApproval: boolean } | null>(null)
const pendingUndo = ref<{ applicationId: string; fromStatus: string; toStatus: string } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | null = null

const isTerminalTransition = computed(() =>
  transitionModal.value
    ? (pipelineStages.value.find((s: any) => s.id === transitionModal.value!.targetStatus)?.terminal ?? false)
    : false,
)

function openTransitionModal(nextStatus: string) {
  const currentStatus = selectedApplication.value?.status
  if (currentStatus && requiresApproval(currentStatus, nextStatus)) {
    transitionModal.value = { targetStatus: nextStatus, isApproval: true }
  } else {
    transitionModal.value = { targetStatus: nextStatus, isApproval: false }
  }
}

async function handleTransitionConfirm(note: string) {
  if (!transitionModal.value || !selectedApplication.value) return
  const { targetStatus } = transitionModal.value
  transitionModal.value = null
  await changeStatus(targetStatus, note)
}

async function handleApprovalRequest(note: string) {
  if (!transitionModal.value || !selectedApplication.value) return
  try {
    await $fetch(`/api/applications/${selectedApplication.value.id}/approval-requests`, {
      method: 'POST',
      body: {
        toStage: transitionModal.value.targetStatus,
        note: note || undefined,
      },
    })
    transitionModal.value = null
    statusError.value = null
  } catch (err: any) {
    statusError.value = err?.data?.statusMessage ?? 'Failed to request approval'
  }
}

async function changeStatus(status: string, note?: string) {
  if (!selectedApplication.value || isMutating.value) return
  const applicationId = selectedApplication.value.id
  const previousStatus = selectedApplication.value.status

  isMutating.value = true
  try {
    await $fetch(`/api/applications/${applicationId}`, {
      method: 'PATCH',
      body: { status },
    })
    if (note?.trim()) {
      await createComment(note.trim())
    }
    track('pipeline_stage_changed', { from_stage: previousStatus, to_stage: status })
    await refreshApps()

    // Show undo toast for non-terminal transitions
    const isTerminal = pipelineStages.value.find((s: any) => s.id === status)?.terminal
    if (!isTerminal) {
      if (undoTimer) clearTimeout(undoTimer)
      pendingUndo.value = { applicationId, fromStatus: previousStatus, toStatus: status }
      undoTimer = setTimeout(() => { pendingUndo.value = null }, 8000)
    }
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    statusError.value = err?.data?.statusMessage ?? 'Failed to update status'
    setTimeout(() => { statusError.value = null }, 6000)
  } finally {
    isMutating.value = false
  }
}

async function undoTransition() {
  if (!pendingUndo.value) return
  const { applicationId, fromStatus } = pendingUndo.value
  pendingUndo.value = null
  if (undoTimer) { clearTimeout(undoTimer); undoTimer = null }
  isMutating.value = true
  try {
    await $fetch(`/api/applications/${applicationId}`, {
      method: 'PATCH',
      body: { status: fromStatus },
    })
    await refreshApps()
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    statusError.value = err?.data?.statusMessage ?? 'Failed to undo'
    setTimeout(() => { statusError.value = null }, 6000)
  } finally {
    isMutating.value = false
  }
}

// ─────────────────────────────────────────────
// Interview scheduling
// ─────────────────────────────────────────────

const showInterviewSidebar = ref(false)
const interviewTargetApplication = ref<{ id: string; name: string } | null>(null)

function openInterviewScheduler() {
  if (!selectedApplication.value) return
  interviewTargetApplication.value = {
    id: selectedApplication.value.id,
    name: `${selectedApplication.value.candidateFirstName} ${selectedApplication.value.candidateLastName}`,
  }
  showInterviewSidebar.value = true
}

async function handleInterviewScheduled() {
  showInterviewSidebar.value = false
  interviewTargetApplication.value = null
  track('interview_scheduled')
  await refreshJobInterviews()

  if (selectedApplication.value && selectedApplication.value.status !== 'interview') {
    const allowed = pipelineTransitions.value[selectedApplication.value.status] ?? []
    if (allowed.includes('interview')) {
      await changeStatus('interview')
    }
  }
}

function handlePanelTransition(status: string) {
  if (status === 'interview') {
    openInterviewScheduler()
  } else {
    openTransitionModal(status)
  }
}

// ─────────────────────────────────────────────
// Job status transitions (labeled colored buttons)
// ─────────────────────────────────────────────

const jobTransitionConfig = computed<Record<string, { label: string; classes: string }>>(() => {
  const currentStatus = jobData.value?.status
  return {
    open: {
      label: currentStatus === 'closed' ? 'Reopen' : 'Publish Job',
      classes: currentStatus === 'closed'
        ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20'
        : 'bg-success-600 text-white hover:bg-success-700 shadow-sm shadow-success-600/20',
    },
    closed: {
      label: 'Close Job',
      classes: 'bg-warning-600 text-white hover:bg-warning-700 shadow-sm shadow-warning-600/20',
    },
    draft: {
      label: 'Revert to Draft',
      classes: 'border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800',
    },
    archived: {
      label: 'Archive',
      classes: 'border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800',
    },
  }
})

const allowedJobTransitions = computed(() => {
  if (!jobData.value) return []
  return JOB_STATUS_TRANSITIONS[jobData.value.status] ?? []
})

const primaryJobTransition = computed(() => allowedJobTransitions.value[0] ?? null)
const secondaryJobTransitions = computed(() => allowedJobTransitions.value.slice(1))

const isJobTransitioning = ref(false)

async function handleJobTransition(newStatus: string) {
  isJobTransitioning.value = true
  try {
    await updateJob({ status: newStatus as any })
    await refreshJob()
    // Refresh sidebar jobs data in AppTopBar so status badge updates
    await refreshNuxtData('sidebar-jobs-list')
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    statusError.value = err?.data?.statusMessage ?? 'Failed to update status'
    setTimeout(() => { statusError.value = null }, 6000)
  } finally {
    isJobTransitioning.value = false
  }
}

// ─────────────────────────────────────────────
// Edit Job modal
// ─────────────────────────────────────────────

const showEditModal = ref(false)
const editForm = ref({ title: '', description: '', location: '', type: 'full_time' as string })
const editSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  location: z.string().optional(),
  type: z.enum(['full_time', 'part_time', 'contract', 'internship']),
})
const isSaving = ref(false)
const editErrors = ref<Record<string, string>>({})

function startEdit() {
  if (!jobData.value) return
  editForm.value = {
    title: jobData.value.title,
    description: jobData.value.description ?? '',
    location: jobData.value.location ?? '',
    type: jobData.value.type,
  }
  editErrors.value = {}
  showEditModal.value = true
}

async function handleSave() {
  const result = editSchema.safeParse(editForm.value)
  if (!result.success) {
    editErrors.value = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0]?.toString()
      if (field) editErrors.value[field] = issue.message
    }
    return
  }
  editErrors.value = {}
  isSaving.value = true
  try {
    await updateJob({
      title: editForm.value.title,
      description: editForm.value.description || undefined,
      location: editForm.value.location || undefined,
      type: editForm.value.type as any,
    })
    showEditModal.value = false
    await refreshNuxtData('sidebar-jobs-list')
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    statusError.value = err?.data?.statusMessage ?? 'Failed to save changes'
    setTimeout(() => { statusError.value = null }, 6000)
  } finally {
    isSaving.value = false
  }
}

const typeOptions = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────

const isDeleting = ref(false)
const showDeleteConfirm = ref(false)

async function handleDelete() {
  isDeleting.value = true
  try {
    await deleteJob()
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    statusError.value = err?.data?.statusMessage ?? 'Failed to delete job'
    setTimeout(() => { statusError.value = null }, 6000)
    isDeleting.value = false
    showDeleteConfirm.value = false
  }
}

// ─────────────────────────────────────────────
// Add candidate
// ─────────────────────────────────────────────

const showApplyModal = ref(false)

function handleCandidateApplied() {
  showApplyModal.value = false
  refreshApps()
}

// ─────────────────────────────────────────────
// Teleport target (for modals)
// ─────────────────────────────────────────────

const pipelineContainer = useTemplateRef<HTMLElement>('pipelineContainer')
const teleportTarget = computed(() => pipelineContainer.value ?? 'body')

// ─────────────────────────────────────────────
// Keyboard shortcuts
// ─────────────────────────────────────────────

useKeyboardShortcuts([
  {
    key: 'Escape',
    handler: () => {
      if (panelOpen.value) { closePanel(); return }
    },
  },
])

// ─────────────────────────────────────────────
// Loading + SEO
// ─────────────────────────────────────────────

const isFullscreen = ref(false)
const isLoading = computed(() => jobFetchStatus.value === 'pending' || appFetchStatus.value === 'pending')

useSeoMeta({
  title: computed(() =>
    jobData.value ? `Pipeline \u2014 ${jobData.value.title} \u2014 Reqcore` : 'Pipeline \u2014 Reqcore',
  ),
  robots: 'noindex, nofollow',
})
</script>

<template>
  <div
    ref="pipelineContainer"
    class="flex flex-col overflow-hidden transition-[margin] duration-200"
    :class="[
      isFullscreen
        ? 'h-screen bg-surface-50 dark:bg-surface-950'
        : '-mx-4 -my-6 sm:-mx-6 lg:-mx-8 lg:-my-8 h-[calc(100vh-3.5rem-2.5rem)]',
    ]"
  >
    <!-- Loading -->
    <div v-if="isLoading" class="flex flex-1 flex-col items-center justify-center gap-3">
      <div class="size-8 rounded-full border-2 border-brand-200 border-t-brand-600 dark:border-brand-800 dark:border-t-brand-400 animate-spin" />
      <p class="text-sm font-medium text-surface-400 dark:text-surface-500">Loading pipeline...</p>
    </div>

    <!-- Error -->
    <div
      v-else-if="jobError || appError"
      class="m-6 rounded-xl border border-danger-200/80 bg-danger-50 p-5 text-sm text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/40 dark:text-danger-300"
    >
      {{ jobError ? 'Job not found or failed to load.' : 'Failed to load applications.' }}
      <NuxtLink :to="$localePath('/dashboard')" class="ml-1 font-medium underline hover:no-underline">Back to Jobs</NuxtLink>
    </div>

    <template v-else-if="jobData">
      <!-- Status error toast -->
      <Transition name="slide-down">
        <div
          v-if="statusError"
          class="pointer-events-auto fixed left-1/2 top-4 z-[200] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-danger-200 bg-white px-4 py-3 shadow-lg dark:border-danger-800/60 dark:bg-surface-900"
        >
          <span class="text-sm font-medium text-danger-700 dark:text-danger-300">{{ statusError }}</span>
          <button
            class="ml-1 flex cursor-pointer items-center justify-center rounded-md p-0.5 text-danger-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-950/60 transition-colors"
            @click="statusError = null"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </Transition>

      <!-- Undo toast -->
      <Transition name="slide-down">
        <div
          v-if="pendingUndo"
          class="pointer-events-auto fixed left-1/2 top-4 z-[200] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 shadow-lg dark:border-surface-700/60 dark:bg-surface-900"
        >
          <span class="text-sm text-surface-700 dark:text-surface-300">
            Moved to <span class="font-semibold">{{ stageLabel(pendingUndo.toStatus) }}</span>
          </span>
          <button
            class="cursor-pointer rounded-md bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700 transition-colors"
            @click="undoTransition"
          >
            Undo
          </button>
          <button
            class="flex cursor-pointer items-center justify-center rounded-md p-0.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800 transition-colors"
            @click="pendingUndo = null"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </Transition>

      <!-- Quick actions teleported to sub-nav bar -->
      <Teleport to="#job-sub-nav-actions">
        <div class="flex items-center gap-1.5">
          <!-- Edit icon button -->
          <button
            class="inline-flex cursor-pointer items-center justify-center rounded-lg border border-surface-200 dark:border-surface-700/80 p-1.5 text-surface-500 hover:bg-white hover:text-surface-700 dark:hover:bg-surface-800 dark:hover:text-surface-300 transition-all duration-150"
            title="Edit job"
            @click="startEdit"
          >
            <Pencil class="size-3.5" />
          </button>

          <!-- Delete icon button -->
          <button
            class="inline-flex cursor-pointer items-center justify-center rounded-lg border border-surface-200 dark:border-surface-700/80 p-1.5 text-surface-400 hover:bg-danger-50 hover:text-danger-600 hover:border-danger-200 dark:hover:bg-danger-950/60 dark:hover:text-danger-400 dark:hover:border-danger-800 transition-all duration-150"
            title="Delete job"
            @click="showDeleteConfirm = true"
          >
            <Trash2 class="size-3.5" />
          </button>

          <div class="w-px h-4 bg-surface-200 dark:bg-surface-700" />

          <!-- Add candidate -->
          <button
            class="hidden sm:inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-surface-200 dark:border-surface-700/80 px-2.5 py-1.5 text-[11px] font-medium text-surface-600 dark:text-surface-300 hover:bg-white hover:border-surface-300 dark:hover:bg-surface-800 dark:hover:border-surface-600 transition-all duration-150"
            @click="showApplyModal = true"
          >
            <UserPlus class="size-3" />
            Add Candidate
          </button>

          <!-- Secondary transitions as inline labeled buttons -->
          <template v-if="secondaryJobTransitions.length > 0">
            <button
              v-for="t in secondaryJobTransitions"
              :key="t"
              :disabled="isJobTransitioning"
              class="hidden sm:inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-surface-200 dark:border-surface-700/80 px-2.5 py-1.5 text-[11px] font-medium text-surface-600 dark:text-surface-300 hover:bg-white hover:border-surface-300 dark:hover:bg-surface-800 dark:hover:border-surface-600 transition-all duration-150 disabled:opacity-50"
              @click="handleJobTransition(t)"
            >
              {{ jobTransitionConfig[t]?.label ?? t }}
            </button>
          </template>

          <!-- Primary transition -->
          <button
            v-if="primaryJobTransition"
            :disabled="isJobTransitioning"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="jobTransitionConfig[primaryJobTransition]?.classes ?? 'border border-surface-300 text-surface-600 hover:bg-surface-50'"
            @click="handleJobTransition(primaryJobTransition)"
          >
            {{ jobTransitionConfig[primaryJobTransition]?.label ?? primaryJobTransition }}
          </button>
        </div>
      </Teleport>

      <!-- ═══════════════════════════════════════ -->
      <!-- BOARD LAYOUT                             -->
      <!-- ═══════════════════════════════════════ -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Board columns (scrollable horizontally) -->
        <div class="flex flex-1 overflow-x-auto">
          <!-- Active stage columns -->
          <div
            v-for="stage in activeStages"
            :key="stage.id"
            class="flex shrink-0 flex-col w-72 border-r border-surface-200/80 dark:border-surface-800/60"
          >
            <!-- Column header -->
            <div
              class="shrink-0 px-3 py-2.5 border-b border-surface-100 dark:border-surface-800/40"
              :class="(stage as any).gate
                ? 'bg-amber-50/60 dark:bg-amber-950/20'
                : 'bg-surface-50/50 dark:bg-surface-900/50'"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="size-2 rounded-full shrink-0" :class="stageColorClass(stage.id, 'dot')" />
                  <span class="text-xs font-semibold whitespace-nowrap text-surface-700 dark:text-surface-300">
                    {{ stage.label }}
                  </span>
                  <!-- Subtle gate indicator -->
                  <span
                    v-if="(stage as any).gate"
                    class="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                  >
                    <CheckCircle2 class="size-2.5" />
                    Gate
                  </span>
                </div>
                <span class="inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums bg-surface-100 text-surface-500 dark:bg-surface-800/80 dark:text-surface-400">
                  {{ statusCounts[stage.id] ?? 0 }}
                </span>
              </div>
            </div>

            <!-- Draggable card area -->
            <draggable
              :list="dragGroups[stage.id]"
              :group="{ name: 'pipeline', pull: true, put: true }"
              item-key="id"
              :animation="200"
              ghost-class="dnd-ghost"
              drag-class="dnd-drag"
              dragover-class="dnd-over"
              class="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px] rounded-lg transition-colors"
              @start="onDragStart"
              @end="onDragEnd"
              @change="(evt: any) => handleDragChange(evt, stage.id)"
            >
              <template #item="{ element: app }">
                <PipelineCandidateCard
                  :id="app.id"
                  :candidate-first-name="app.candidateFirstName"
                  :candidate-last-name="app.candidateLastName"
                  :candidate-email="app.candidateEmail"
                  :score="app.score"
                  :created-at="app.createdAt"
                  :status="app.status"
                  :selected="selectedApplicationId === app.id"
                  :has-interview="applicationsWithInterviews.has(app.id)"
                  @click="selectCandidate(app.id)"
                />
              </template>

              <template #footer>
                <div
                  v-if="(dragGroups[stage.id] ?? []).length === 0 && !isDragging"
                  class="flex flex-col items-center justify-center py-8 text-center"
                >
                  <UserRound class="size-5 text-surface-300 dark:text-surface-600 mb-1.5" />
                  <p class="text-[11px] text-surface-400 dark:text-surface-500">No candidates</p>
                </div>
              </template>
            </draggable>
          </div>

          <!-- Dashed separator before terminal stages -->
          <template v-if="terminalStages.length > 0">
            <div class="flex shrink-0 items-start pt-[18px] px-1">
              <div class="w-8 border-t border-dashed border-surface-300 dark:border-surface-600" />
            </div>

            <!-- Terminal stage columns -->
            <div
              v-for="stage in terminalStages"
              :key="stage.id"
              class="flex shrink-0 flex-col w-60 bg-surface-50/30 dark:bg-surface-950/20 border-r border-surface-200/80 dark:border-surface-800/60"
            >
              <div class="shrink-0 px-3 py-2.5 border-b bg-surface-50/80 dark:bg-surface-900/30 border-surface-100 dark:border-surface-800/40">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="size-2 rounded-full shrink-0" :class="stageColorClass(stage.id, 'dot')" />
                    <span class="text-xs font-semibold whitespace-nowrap text-surface-500 dark:text-surface-400">
                      {{ stage.label }}
                    </span>
                  </div>
                  <span class="inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums bg-surface-100 text-surface-400 dark:bg-surface-800/80 dark:text-surface-500">
                    {{ statusCounts[stage.id] ?? 0 }}
                  </span>
                </div>
              </div>

              <draggable
                :list="dragGroups[stage.id]"
                :group="{ name: 'pipeline', pull: true, put: true }"
                item-key="id"
                :animation="200"
                ghost-class="dnd-ghost"
                drag-class="dnd-drag"
                dragover-class="dnd-over"
                class="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px] rounded-lg transition-colors"
                @start="onDragStart"
                @end="onDragEnd"
                @change="(evt: any) => handleDragChange(evt, stage.id)"
              >
                <template #item="{ element: app }">
                  <PipelineCandidateCard
                    :id="app.id"
                    :candidate-first-name="app.candidateFirstName"
                    :candidate-last-name="app.candidateLastName"
                    :candidate-email="app.candidateEmail"
                    :score="app.score"
                    :created-at="app.createdAt"
                    :status="app.status"
                    :selected="selectedApplicationId === app.id"
                    :has-interview="applicationsWithInterviews.has(app.id)"
                    @click="selectCandidate(app.id)"
                  />
                </template>

                <template #footer>
                  <div
                    v-if="(dragGroups[stage.id] ?? []).length === 0 && !isDragging"
                    class="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <UserRound class="size-5 text-surface-300 dark:text-surface-600 mb-1.5" />
                    <p class="text-[11px] text-surface-400 dark:text-surface-500">No candidates</p>
                  </div>
                </template>
              </draggable>
            </div>
          </template>
        </div>

        <!-- Slide-in detail panel -->
        <PipelineCandidateSlidePanel
          :open="panelOpen"
          :application="selectedApplication"
          :application-detail="resolvedCurrentApplication"
          :comments="comments"
          :activity-items="activityItems"
          :tasks="tasks"
          :interviews="currentApplicationInterviews"
          :candidate-links="candidateLinks"
          :allowed-transitions="allowedTransitions"
          :is-mutating="isMutating"
          :is-detail-loading="detailFetchStatus === 'pending' && !resolvedCurrentApplication"
          @close="closePanel"
          @transition="handlePanelTransition"
          @open-interview-scheduler="openInterviewScheduler"
          @navigate-to-application="(id) => router.push(localePath(`/dashboard/applications/${id}`))"
          @create-comment="createComment"
          @create-task="createTask"
          @toggle-task="(id, completed) => toggleTask(id, completed)"
          @delete-task="deleteTask"
          @delete-comment="deleteComment"
          @update-comment="updateComment"
        />
      </div>
    </template>

    <!-- ═══════════════════════════════════════ -->
    <!-- MODALS                                   -->
    <!-- ═══════════════════════════════════════ -->

    <!-- Transition / Approval Modal -->
    <PipelineTransitionModal
      :open="!!transitionModal"
      :target-status="transitionModal?.targetStatus ?? ''"
      :candidate-name="selectedApplication ? `${selectedApplication.candidateFirstName} ${selectedApplication.candidateLastName}` : ''"
      :is-terminal="isTerminalTransition"
      :requires-approval="transitionModal?.isApproval ?? false"
      @confirm="handleTransitionConfirm"
      @request-approval="handleApprovalRequest"
      @close="transitionModal = null"
    />

    <!-- Edit Job Modal -->
    <Teleport :to="teleportTarget">
      <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showEditModal = false" />
        <div class="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl ring-1 ring-surface-200/80 dark:ring-surface-700/60 p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Edit Job</h3>

          <form class="space-y-4" @submit.prevent="handleSave">
            <div>
              <label for="edit-title" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Title <span class="text-danger-500">*</span>
              </label>
              <input
                id="edit-title"
                v-model="editForm.title"
                type="text"
                class="w-full rounded-lg border px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                :class="editErrors.title ? 'border-danger-300' : 'border-surface-300 dark:border-surface-700'"
              />
              <p v-if="editErrors.title" class="mt-1 text-xs text-danger-600">{{ editErrors.title }}</p>
            </div>

            <div>
              <label for="edit-description" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Description</label>
              <textarea
                id="edit-description"
                v-model="editForm.description"
                rows="4"
                class="w-full rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
              />
            </div>

            <div>
              <label for="edit-location" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Location</label>
              <input
                id="edit-location"
                v-model="editForm.location"
                type="text"
                class="w-full rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
              />
            </div>

            <div>
              <label for="edit-type" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Employment Type</label>
              <select
                id="edit-type"
                v-model="editForm.type"
                class="w-full rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
              >
                <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                class="cursor-pointer rounded-lg border border-surface-300 dark:border-surface-700 px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                @click="showEditModal = false"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSaving"
                class="cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ isSaving ? 'Saving\u2026' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirm -->
    <Teleport :to="teleportTarget">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showDeleteConfirm = false" />
        <div class="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl ring-1 ring-surface-200/80 dark:ring-surface-700/60 p-6 max-w-sm w-full mx-4">
          <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">Delete Job</h3>
          <p class="text-sm text-surface-600 dark:text-surface-400 mb-4">
            Are you sure you want to delete <strong>{{ jobData?.title }}</strong>? This will also delete all associated applications. This action cannot be undone.
          </p>
          <div class="flex justify-end gap-2">
            <button
              :disabled="isDeleting"
              class="cursor-pointer rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-1.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              @click="showDeleteConfirm = false"
            >
              Cancel
            </button>
            <button
              :disabled="isDeleting"
              class="cursor-pointer rounded-lg bg-danger-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-danger-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              @click="handleDelete"
            >
              {{ isDeleting ? 'Deleting\u2026' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Apply Candidate Modal -->
    <ApplyCandidateModal
      v-if="showApplyModal"
      :job-id="jobId"
      :teleport-target="teleportTarget"
      @close="showApplyModal = false"
      @created="handleCandidateApplied"
    />

    <!-- Interview Schedule Sidebar -->
    <InterviewScheduleSidebar
      v-if="showInterviewSidebar && interviewTargetApplication"
      :application-id="interviewTargetApplication.id"
      :candidate-name="interviewTargetApplication.name"
      :job-title="jobData?.title ?? ''"
      :teleport-target="teleportTarget"
      @close="showInterviewSidebar = false"
      @scheduled="handleInterviewScheduled"
    />

  </div>
</template>

<style scoped>
/* Drag ghost: card being dragged from */
:deep(.dnd-ghost) {
  opacity: 0.3;
}
/* Drag class: the floating card following cursor */
:deep(.dnd-drag) {
  transform: rotate(2deg);
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
}
/* Drop zone highlight when dragging over a column */
:deep(.dnd-over) {
  background-color: rgb(239 246 255 / 0.6); /* brand-50 light */
  outline: 2px dashed rgb(147 197 253 / 0.8); /* brand-300 */
  outline-offset: -2px;
}
:root.dark :deep(.dnd-over) {
  background-color: rgb(23 37 84 / 0.3); /* brand-950 dark */
  outline-color: rgb(30 64 175 / 0.5);
}
</style>
