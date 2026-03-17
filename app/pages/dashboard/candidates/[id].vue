<script setup lang="ts">
import { ArrowLeft, Pencil, Trash2, Mail, Phone, Calendar, Briefcase, FileText, Plus, Upload, Download, Eye, X, AlertTriangle, Github, Linkedin, Globe, MessageSquare, History } from 'lucide-vue-next'
import { z } from 'zod'
import { usePreviewReadOnly } from '~/composables/usePreviewReadOnly'
import type { AssessmentDecision } from '~~/shared/assessment-types'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

const route = useRoute()
const candidateId = route.params.id as string
const { handlePreviewReadOnlyError } = usePreviewReadOnly()

const { candidate, status: fetchStatus, error, refresh, updateCandidate, deleteCandidate } = useCandidate(candidateId)
const { stageLabel, stageColorClass } = usePipelineConfig()

useSeoMeta({
  title: computed(() =>
    candidate.value
      ? `${candidate.value.firstName} ${candidate.value.lastName} - Reqcore`
      : 'Candidate - Reqcore',
  ),
})

// ─────────────────────────────────────────────
// Toast error (replaces alert())
// ─────────────────────────────────────────────

const toastError = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toastError.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastError.value = null }, 6000)
}

function dismissToast() {
  toastError.value = null
  if (toastTimer) clearTimeout(toastTimer)
}

// ─────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────

const activeTab = ref<'applications' | 'documents' | 'activity'>('applications')

// ─────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────

// getCandidateInitials() auto-imported from ~/utils/pipeline-helpers

const firstAppliedDate = computed(() => {
  const apps = candidate.value?.applications
  if (!apps?.length) return null
  const oldest = apps.reduce((a: any, b: any) =>
    new Date(a.createdAt) < new Date(b.createdAt) ? a : b,
  )
  return new Date(oldest.createdAt).toLocaleDateString()
})

// DOC_TYPE_LABELS / formatDocumentType() auto-imported from ~/utils/pipeline-helpers

const decisionLabels: Record<string, string> = {
  hire: 'Hire',
  no_hire: 'No Hire',
  borderline: 'Borderline',
  pending: 'Pending',
}

const decisionClasses: Record<string, string> = {
  hire: 'bg-success-50 text-success-700 dark:bg-success-950/50 dark:text-success-300',
  no_hire: 'bg-danger-50 text-danger-700 dark:bg-danger-950/50 dark:text-danger-300',
  borderline: 'bg-warning-50 text-warning-700 dark:bg-warning-950/50 dark:text-warning-300',
  pending: 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400',
}

// ─────────────────────────────────────────────
// Edit mode
// ─────────────────────────────────────────────

const isEditing = ref(false)
const editForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
})

function startEdit() {
  if (!candidate.value) return
  editForm.value = {
    firstName: candidate.value.firstName,
    lastName: candidate.value.lastName,
    email: candidate.value.email,
    phone: candidate.value.phone ?? '',
  }
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editErrors.value = {}
}

const editSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email address').max(255),
  phone: z.string().max(50).optional(),
})

const isSaving = ref(false)
const editErrors = ref<Record<string, string>>({})

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
    await updateCandidate({
      firstName: editForm.value.firstName,
      lastName: editForm.value.lastName,
      email: editForm.value.email,
      phone: editForm.value.phone || null,
    })
    isEditing.value = false
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    const message = err.data?.statusMessage ?? 'Failed to save changes'
    if (err.statusCode === 409 || err.data?.statusCode === 409) {
      editErrors.value.email = message
    } else {
      showToast(message)
    }
  } finally {
    isSaving.value = false
  }
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────

const isDeleting = ref(false)
const showDeleteConfirm = ref(false)

async function handleDelete() {
  isDeleting.value = true
  try {
    await deleteCandidate()
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    showToast(err.data?.statusMessage ?? 'Failed to delete candidate')
    isDeleting.value = false
    showDeleteConfirm.value = false
  }
}

// ─────────────────────────────────────────────
// Candidate links
// ─────────────────────────────────────────────

const { links: candidateLinks, isLoading: linksLoading, addLink, removeLink } = useCandidateLinks(
  computed(() => candidate.value?.id),
)

const showAddLink = ref(false)
const newLinkType = ref('github')
const newLinkUrl = ref('')
const newLinkLabel = ref('')
const isAddingLink = ref(false)
const addLinkError = ref<string | null>(null)

async function submitAddLink() {
  if (!newLinkUrl.value.trim()) return
  isAddingLink.value = true
  addLinkError.value = null
  try {
    await addLink({ type: newLinkType.value, url: newLinkUrl.value.trim(), label: newLinkLabel.value.trim() || undefined })
    showAddLink.value = false
    newLinkUrl.value = ''
    newLinkLabel.value = ''
    newLinkType.value = 'github'
  }
  catch (err: any) {
    addLinkError.value = err?.data?.statusMessage ?? 'Failed to add link'
  }
  finally {
    isAddingLink.value = false
  }
}

// ─────────────────────────────────────────────
// Activity tab
// ─────────────────────────────────────────────

const activitySubTab = ref<'all' | 'comments' | 'history'>('all')

const { data: commentsData } = useFetch<{ data: any[]; total: number }>('/api/comments', {
  key: computed(() => `candidate-comments-${candidateId}`),
  query: computed(() => ({ candidateId, page: 1, limit: 100 })),
  headers: useRequestHeaders(['cookie']),
})
const activityComments = computed(() => commentsData.value?.data ?? [])

const { data: activityLogData } = useFetch<{ data: any[]; total: number }>('/api/activity-log', {
  key: computed(() => `candidate-activity-${candidateId}`),
  query: computed(() => ({ candidateId, page: 1, limit: 100 })),
  headers: useRequestHeaders(['cookie']),
})
const activityItems = computed(() => activityLogData.value?.data ?? [])

type FeedItem =
  | { kind: 'comment'; ts: string; data: any }
  | { kind: 'history'; ts: string; data: any }

const feedAll = computed((): FeedItem[] => {
  const items: FeedItem[] = [
    ...activityComments.value.map((c: any) => ({ kind: 'comment' as const, ts: c.createdAt, data: c })),
    ...activityItems.value.map((a: any) => ({ kind: 'history' as const, ts: String(a.createdAt), data: a })),
  ]
  return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
})

const feedFiltered = computed(() => {
  const sub = activitySubTab.value
  if (sub === 'comments') return feedAll.value.filter(i => i.kind === 'comment')
  if (sub === 'history') return feedAll.value.filter(i => i.kind === 'history')
  return feedAll.value
})

// timeAgo() auto-imported from ~/utils/pipeline-helpers

function formatActivityAction(action: string, metadata: Record<string, string> | null): string {
  if (action === 'status_changed' && metadata?.from && metadata?.to) {
    return `Moved ${stageLabel(metadata.from)} to ${stageLabel(metadata.to)}`
  }
  const labels: Record<string, string> = {
    updated: 'Application updated',
    created: 'Application created',
    document_uploaded: 'Document uploaded',
    interview_scheduled: 'Interview scheduled',
  }
  return labels[action] ?? action.replace(/_/g, ' ')
}

// ─────────────────────────────────────────────
// Apply to job modal
// ─────────────────────────────────────────────

const showApplyModal = ref(false)

function handleApplied() {
  showApplyModal.value = false
  refresh()
}

// ─────────────────────────────────────────────
// Interview scheduling
// ─────────────────────────────────────────────

const showInterviewSidebar = ref(false)
const interviewTargetApp = ref<{ id: string; jobTitle: string } | null>(null)

function openScheduleInterview(app: { id: string; job: { title: string } }) {
  interviewTargetApp.value = { id: app.id, jobTitle: app.job.title }
  showInterviewSidebar.value = true
}

// ─────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────

const { uploadDocument, downloadDocument, getPreviewUrl, deleteDocument } = useDocuments()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedDocType = ref<'resume' | 'cover_letter' | 'portfolio' | 'reference' | 'certificate' | 'other'>('resume')
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const showDocDeleteConfirm = ref<string | null>(null)
const isDeletingDoc = ref(false)

const showPreview = ref(false)
const previewUrl = ref<string | null>(null)
const previewFilename = ref('')
const previewMimeType = ref('')
const previewDocId = ref<string | null>(null)
const previewError = ref<string | null>(null)

const isPdfPreview = computed(() => previewMimeType.value === 'application/pdf')

async function handlePreview(docId: string, mimeType?: string) {
  if (mimeType && mimeType !== 'application/pdf') {
    await handleDownload(docId)
    return
  }

  previewError.value = null
  showPreview.value = true
  previewDocId.value = docId

  const doc = candidate.value?.documents?.find((d: any) => d.id === docId)
  previewFilename.value = doc?.originalFilename ?? 'Document'
  previewMimeType.value = doc?.mimeType ?? 'application/pdf'
  previewUrl.value = getPreviewUrl(docId)
}

function closePreview() {
  showPreview.value = false
  previewUrl.value = null
  previewFilename.value = ''
  previewMimeType.value = ''
  previewDocId.value = null
  previewError.value = null
}

function triggerFileSelect() {
  fileInput.value?.click()
}

async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadError.value = null
  isUploading.value = true

  try {
    await uploadDocument(candidateId, file, selectedDocType.value)
  } catch (err: any) {
    const msg = err.data?.statusMessage ?? err.statusMessage ?? 'Upload failed'
    uploadError.value = msg
  } finally {
    isUploading.value = false
    input.value = ''
  }
}

async function handleDownload(docId: string) {
  try {
    await downloadDocument(docId)
  } catch {
    showToast('Failed to download document')
  }
}

async function handleDeleteDoc(docId: string) {
  isDeletingDoc.value = true
  try {
    await deleteDocument(docId, candidateId)
    showDocDeleteConfirm.value = null
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    showToast(err.data?.statusMessage ?? 'Failed to delete document')
  } finally {
    isDeletingDoc.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <!-- Breadcrumb -->
    <div class="mb-6">
      <AppBreadcrumb :items="[
        { label: 'Candidates', to: $localePath('/dashboard/candidates') },
        { label: candidate ? `${candidate.firstName} ${candidate.lastName}` : '…' },
      ]" />
    </div>

    <!-- Toast error -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 translate-y-2"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="toastError"
          class="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-danger-200 dark:border-danger-800 bg-white dark:bg-surface-900 px-4 py-3 shadow-lg text-sm text-danger-700 dark:text-danger-400 max-w-md"
        >
          <span class="flex-1">{{ toastError }}</span>
          <button class="shrink-0 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 cursor-pointer" @click="dismissToast">
            <X class="size-4" />
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Loading -->
    <div v-if="fetchStatus === 'pending'" class="text-center py-12 text-surface-400">
      Loading candidate…
    </div>

    <!-- Error / not found -->
    <div
      v-else-if="error"
      class="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700"
    >
      {{ error.statusCode === 404 ? 'Candidate not found.' : 'Failed to load candidate.' }}
      <NuxtLink :to="$localePath('/dashboard/candidates')" class="underline ml-1">Back to Candidates</NuxtLink>
    </div>

    <!-- Candidate detail -->
    <template v-else-if="candidate">
      <!-- VIEW MODE -->
      <div v-if="!isEditing">
        <!-- Header card -->
        <div class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5 mb-5">
          <div class="flex items-start gap-4">
            <!-- Avatar -->
            <div class="size-14 shrink-0 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-semibold text-lg">
              {{ getCandidateInitials(candidate.firstName, candidate.lastName) }}
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-50 truncate">
                  {{ candidate.firstName }} {{ candidate.lastName }}
                </h1>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-surface-300 dark:border-surface-700 px-2.5 py-1 text-xs font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                    @click="startEdit"
                  >
                    <Pencil class="size-3" />
                    Edit
                  </button>
                  <button
                    class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-danger-300 dark:border-danger-700 px-2.5 py-1 text-xs font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950 transition-colors"
                    @click="showDeleteConfirm = true"
                  >
                    <Trash2 class="size-3" />
                  </button>
                </div>
              </div>

              <!-- Contact row -->
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-surface-500">
                <a
                  :href="`mailto:${candidate.email}`"
                  target="_blank"
                  class="inline-flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 hover:underline cursor-pointer transition-colors"
                >
                  <Mail class="size-3.5" />
                  {{ candidate.email }}
                </a>
                <span v-if="candidate.phone" class="inline-flex items-center gap-1">
                  <Phone class="size-3.5" />
                  {{ candidate.phone }}
                </span>
              </div>

              <!-- Links row -->
              <div class="flex flex-wrap items-center gap-2 mt-2">
                <template v-if="candidateLinks.length">
                  <a
                    v-for="link in candidateLinks"
                    :key="link.id"
                    :href="link.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 rounded-full border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-2 py-0.5 text-xs text-surface-600 dark:text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-300 dark:hover:border-brand-700 transition-colors group"
                    :title="link.url"
                  >
                    <component
                      :is="link.type === 'github' ? Github : link.type === 'linkedin' ? Linkedin : Globe"
                      class="size-3 shrink-0"
                    />
                    <span class="max-w-[120px] truncate">{{ link.label || link.url.replace(/^https?:\/\//, '').split('/')[0] }}</span>
                    <button
                      class="ml-0.5 text-surface-300 hover:text-danger-500 dark:text-surface-600 dark:hover:text-danger-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Remove"
                      @click.prevent="removeLink(link.id)"
                    >
                      <X class="size-2.5" />
                    </button>
                  </a>
                </template>
                <button
                  class="inline-flex cursor-pointer items-center gap-0.5 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
                  @click="showAddLink = !showAddLink"
                >
                  <Plus class="size-3" />
                  Add link
                </button>
              </div>

              <!-- Add link form (inline) -->
              <div v-if="showAddLink" class="mt-2 space-y-2">
                <div class="flex gap-2">
                  <select
                    v-model="newLinkType"
                    class="rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-2 py-1 text-xs text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500 shrink-0"
                  >
                    <option value="github">GitHub</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="portfolio">Portfolio</option>
                    <option value="website">Website</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    v-model="newLinkUrl"
                    type="url"
                    placeholder="https://…"
                    class="flex-1 min-w-0 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-2.5 py-1 text-xs text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    @keydown.enter.prevent="submitAddLink"
                  />
                </div>
                <p v-if="addLinkError" class="text-xs text-danger-600 dark:text-danger-400">{{ addLinkError }}</p>
                <div class="flex gap-2">
                  <button
                    :disabled="isAddingLink || !newLinkUrl.trim()"
                    class="cursor-pointer rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    @click="submitAddLink"
                  >
                    {{ isAddingLink ? 'Adding…' : 'Add' }}
                  </button>
                  <button
                    class="cursor-pointer rounded-lg border border-surface-300 dark:border-surface-600 px-3 py-1 text-xs font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                    @click="showAddLink = false; addLinkError = null"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Quick stats -->
              <div class="flex items-center gap-3 mt-3 text-xs text-surface-400">
                <span>{{ candidate.applications?.length ?? 0 }} application{{ (candidate.applications?.length ?? 0) !== 1 ? 's' : '' }}</span>
                <span v-if="firstAppliedDate" class="inline-flex items-center gap-1">
                  <Calendar class="size-3" />
                  First applied {{ firstAppliedDate }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="border-b border-surface-200 dark:border-surface-800 mb-4">
          <div class="flex gap-1">
            <button
              v-for="tab in (['applications', 'documents', 'activity'] as const)"
              :key="tab"
              class="cursor-pointer px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize"
              :class="activeTab === tab
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300 dark:hover:text-surface-300'"
              @click="activeTab = tab"
            >
              {{ tab === 'applications' ? `Applications (${candidate.applications?.length ?? 0})` : tab === 'documents' ? `Documents (${candidate.documents?.length ?? 0})` : 'Activity' }}
            </button>
          </div>
        </div>

        <!-- ─── Applications tab ─── -->
        <div v-if="activeTab === 'applications'">
          <div class="flex justify-end mb-3">
            <button
              class="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 dark:border-surface-600 px-3 py-1.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer"
              @click="showApplyModal = true"
            >
              <Plus class="size-3.5" />
              Apply to Job
            </button>
          </div>

          <div
            v-if="!candidate.applications?.length"
            class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-8 text-center"
          >
            <Briefcase class="size-8 text-surface-300 dark:text-surface-600 mx-auto mb-2" />
            <p class="text-sm text-surface-500 dark:text-surface-400">No applications yet.</p>
          </div>

          <div v-else class="space-y-2">
            <NuxtLink
              v-for="app in candidate.applications"
              :key="app.id"
              :to="$localePath(`/dashboard/applications/${app.id}`)"
              class="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-3 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-sm transition-all group"
            >
              <div class="min-w-0 flex-1">
                <h4 class="text-sm font-semibold text-surface-900 dark:text-surface-100 group-hover:text-brand-600 transition-colors truncate">
                  {{ app.job.title }}
                </h4>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs text-surface-400">
                    Applied {{ new Date(app.createdAt).toLocaleDateString() }}
                  </span>
                  <template v-if="app.assessment?.overallScore != null">
                    <span class="text-xs font-medium text-surface-600 dark:text-surface-300">
                      {{ app.assessment.overallScore.toFixed(1) }} / 10
                    </span>
                  </template>
                  <template v-if="app.assessment?.decision && app.assessment.decision !== 'pending'">
                    <span
                      class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ring-current/10"
                      :class="decisionClasses[app.assessment.decision as AssessmentDecision] ?? decisionClasses.pending"
                    >
                      {{ decisionLabels[app.assessment.decision as AssessmentDecision] ?? app.assessment.decision }}
                    </span>
                  </template>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0 ml-3">
                <button
                  class="inline-flex items-center gap-1 rounded-lg border border-surface-200 dark:border-surface-700 px-2 py-1 text-xs font-medium text-surface-600 dark:text-surface-400 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 hover:text-brand-700 dark:hover:text-brand-300 transition-all cursor-pointer"
                  title="Schedule Interview"
                  @click.prevent="openScheduleInterview(app)"
                >
                  <Calendar class="size-3" />
                  Schedule
                </button>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/10 shrink-0"
                  :class="stageColorClass(app.status, 'badge')"
                >
                  {{ stageLabel(app.status) }}
                </span>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- Apply to Job Modal -->
        <ApplyToJobModal
          v-if="showApplyModal"
          :candidate-id="candidateId"
          @close="showApplyModal = false"
          @created="handleApplied"
        />

        <!-- Interview Schedule Sidebar -->
        <InterviewScheduleSidebar
          v-if="showInterviewSidebar && interviewTargetApp"
          :application-id="interviewTargetApp.id"
          :candidate-name="`${candidate.firstName} ${candidate.lastName}`"
          :job-title="interviewTargetApp.jobTitle"
          @close="showInterviewSidebar = false"
          @scheduled="showInterviewSidebar = false"
        />

        <!-- ─── Documents tab ─── -->
        <div v-if="activeTab === 'documents'">
          <input
            ref="fileInput"
            type="file"
            accept=".pdf,.doc,.docx"
            class="hidden"
            @change="handleFileSelected"
          />

          <template v-if="showPreview">
            <div class="flex items-center justify-between mb-3">
              <button
                class="inline-flex items-center gap-1.5 text-sm font-medium text-surface-600 dark:text-surface-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer"
                @click="closePreview"
              >
                <ArrowLeft class="size-3.5" />
                Back to documents
              </button>
              <div class="flex items-center gap-1">
                <button
                  v-if="previewDocId"
                  class="rounded-lg p-1.5 text-surface-400 hover:text-brand-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                  title="Download"
                  @click="handleDownload(previewDocId!)"
                >
                  <Download class="size-4" />
                </button>
              </div>
            </div>

            <div v-if="previewFilename" class="flex items-center gap-2 mb-3">
              <FileText class="size-4 text-surface-400 shrink-0" />
              <span class="text-sm font-medium text-surface-700 dark:text-surface-200 truncate">
                {{ previewFilename }}
              </span>
            </div>

            <div
              v-if="previewError"
              class="rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-6 text-center"
            >
              <AlertTriangle class="size-8 text-danger-400 mx-auto mb-2" />
              <p class="text-sm text-danger-700 dark:text-danger-400">{{ previewError }}</p>
              <button
                class="mt-3 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium cursor-pointer"
                @click="closePreview"
              >
                Go back
              </button>
            </div>

            <iframe
              v-else-if="previewUrl && isPdfPreview"
              :src="previewUrl"
              class="w-full rounded-lg border border-surface-200 dark:border-surface-800"
              style="height: 70vh;"
              title="Document preview"
            />
          </template>

          <template v-else>
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <select
                  v-model="selectedDocType"
                  class="rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-2.5 py-1.5 text-sm text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="resume">Resume</option>
                  <option value="cover_letter">Cover Letter</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="reference">Reference</option>
                  <option value="certificate">Certificate</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                :disabled="isUploading"
                class="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 dark:border-surface-600 px-3 py-1.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                @click="triggerFileSelect"
              >
                <Upload class="size-3.5" />
                {{ isUploading ? 'Uploading…' : 'Upload Document' }}
              </button>
            </div>

            <div
              v-if="uploadError"
              class="rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-3 text-sm text-danger-700 dark:text-danger-400 mb-3"
            >
              {{ uploadError }}
              <button class="underline ml-1 cursor-pointer" @click="uploadError = null">Dismiss</button>
            </div>

            <div
              v-if="!candidate.documents?.length"
              class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-8 text-center"
            >
              <FileText class="size-8 text-surface-300 dark:text-surface-600 mx-auto mb-2" />
              <p class="text-sm text-surface-500 dark:text-surface-400">No documents yet.</p>
              <p class="text-xs text-surface-400 mt-1">
                Upload a resume, cover letter, or other document (PDF, DOC, DOCX, max 10 MB).
              </p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="doc in candidate.documents"
                :key="doc.id"
                class="group flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-3 transition-colors"
                :class="doc.mimeType === 'application/pdf' ? 'cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/50 dark:hover:bg-brand-950/30' : ''"
                @click="doc.mimeType === 'application/pdf' ? handlePreview(doc.id, doc.mimeType) : undefined"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <FileText class="size-4 shrink-0" :class="doc.mimeType === 'application/pdf' ? 'text-danger-500 dark:text-danger-400' : 'text-surface-400'" />
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-surface-700 dark:text-surface-200 truncate">
                      {{ doc.originalFilename }}
                    </p>
                    <span class="text-xs text-surface-400">
                      {{ formatDocumentType(doc.type) }}
                      · {{ new Date(doc.createdAt).toLocaleDateString() }}
                      <template v-if="doc.mimeType === 'application/pdf'"> · <span class="text-brand-500 dark:text-brand-400">Click to preview</span></template>
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0" @click.stop>
                  <button
                    v-if="doc.mimeType === 'application/pdf'"
                    class="rounded-lg p-1.5 text-surface-400 hover:text-brand-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                    title="Preview PDF"
                    @click="handlePreview(doc.id, doc.mimeType)"
                  >
                    <Eye class="size-4" />
                  </button>
                  <button
                    class="rounded-lg p-1.5 text-surface-400 hover:text-brand-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                    title="Download"
                    @click="handleDownload(doc.id)"
                  >
                    <Download class="size-4" />
                  </button>
                  <button
                    class="rounded-lg p-1.5 text-surface-400 hover:text-danger-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                    title="Delete"
                    @click="showDocDeleteConfirm = doc.id"
                  >
                    <Trash2 class="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- Document delete confirmation dialog -->
          <Teleport to="body">
            <div v-if="showDocDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
              <div class="absolute inset-0 bg-black/50" @click="showDocDeleteConfirm = null" />
              <div class="relative bg-white dark:bg-surface-900 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2">Delete Document</h3>
                <p class="text-sm text-surface-600 dark:text-surface-400 mb-4">
                  Are you sure you want to delete this document? This action cannot be undone.
                </p>
                <div class="flex justify-end gap-2">
                  <button
                    :disabled="isDeletingDoc"
                    class="rounded-lg border border-surface-300 dark:border-surface-600 px-3 py-1.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                    @click="showDocDeleteConfirm = null"
                  >
                    Cancel
                  </button>
                  <button
                    :disabled="isDeletingDoc"
                    class="rounded-lg bg-danger-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-danger-700 disabled:opacity-50 transition-colors cursor-pointer"
                    @click="handleDeleteDoc(showDocDeleteConfirm!)"
                  >
                    {{ isDeletingDoc ? 'Deleting…' : 'Delete' }}
                  </button>
                </div>
              </div>
            </div>
          </Teleport>
        </div>

        <!-- ─── Activity tab ─── -->
        <div v-if="activeTab === 'activity'">
          <!-- Sub-tabs -->
          <div class="flex gap-1 mb-4">
            <button
              v-for="sub in (['all', 'comments', 'history'] as const)"
              :key="sub"
              class="cursor-pointer rounded-lg px-3 py-1 text-xs font-medium transition-colors capitalize"
              :class="activitySubTab === sub
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
                : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'"
              @click="activitySubTab = sub"
            >
              {{ sub }}
            </button>
          </div>

          <!-- Feed -->
          <div v-if="!feedFiltered.length" class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-8 text-center">
            <History class="size-8 text-surface-300 dark:text-surface-600 mx-auto mb-2" />
            <p class="text-sm text-surface-500 dark:text-surface-400">No activity yet.</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="(item, idx) in feedFiltered"
              :key="idx"
              class="flex gap-3"
            >
              <!-- Icon -->
              <div class="shrink-0 mt-0.5">
                <div
                  v-if="item.kind === 'comment'"
                  class="size-6 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center"
                >
                  <MessageSquare class="size-3 text-brand-600 dark:text-brand-400" />
                </div>
                <div
                  v-else
                  class="size-6 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center"
                >
                  <History class="size-3 text-surface-400" />
                </div>
              </div>

              <!-- Content -->
              <div class="min-w-0 flex-1">
                <template v-if="item.kind === 'comment'">
                  <div class="flex items-center gap-2 text-xs">
                    <span class="font-medium text-surface-700 dark:text-surface-200">{{ item.data.authorName ?? item.data.authorEmail }}</span>
                    <span class="text-surface-400">{{ timeAgo(item.ts) }}</span>
                  </div>
                  <p class="text-sm text-surface-600 dark:text-surface-300 mt-0.5 whitespace-pre-wrap">{{ item.data.body }}</p>
                </template>
                <template v-else>
                  <div class="flex items-center gap-2 text-xs">
                    <span class="font-medium text-surface-700 dark:text-surface-200">{{ item.data.actorName ?? item.data.actorEmail }}</span>
                    <span class="text-surface-400">{{ timeAgo(item.ts) }}</span>
                  </div>
                  <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                    {{ formatActivityAction(item.data.action, item.data.metadata) }}
                  </p>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- EDIT MODE -->
      <div v-else>
        <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50 mb-6">Edit Candidate</h1>

        <form class="space-y-5" @submit.prevent="handleSave">
          <div>
            <label for="edit-firstName" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              First Name <span class="text-danger-500">*</span>
            </label>
            <input
              id="edit-firstName"
              v-model="editForm.firstName"
              type="text"
              class="w-full rounded-lg border px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
              :class="editErrors.firstName ? 'border-danger-300' : 'border-surface-300 dark:border-surface-700'"
            />
            <p v-if="editErrors.firstName" class="mt-1 text-xs text-danger-600 dark:text-danger-400">{{ editErrors.firstName }}</p>
          </div>

          <div>
            <label for="edit-lastName" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Last Name <span class="text-danger-500">*</span>
            </label>
            <input
              id="edit-lastName"
              v-model="editForm.lastName"
              type="text"
              class="w-full rounded-lg border px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
              :class="editErrors.lastName ? 'border-danger-300' : 'border-surface-300 dark:border-surface-700'"
            />
            <p v-if="editErrors.lastName" class="mt-1 text-xs text-danger-600 dark:text-danger-400">{{ editErrors.lastName }}</p>
          </div>

          <div>
            <label for="edit-email" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Email <span class="text-danger-500">*</span>
            </label>
            <input
              id="edit-email"
              v-model="editForm.email"
              type="email"
              class="w-full rounded-lg border px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
              :class="editErrors.email ? 'border-danger-300' : 'border-surface-300 dark:border-surface-700'"
            />
            <p v-if="editErrors.email" class="mt-1 text-xs text-danger-600 dark:text-danger-400">{{ editErrors.email }}</p>
          </div>

          <div>
            <label for="edit-phone" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Phone
            </label>
            <input
              id="edit-phone"
              v-model="editForm.phone"
              type="tel"
              class="w-full rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
            />
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button
              type="submit"
              :disabled="isSaving"
              class="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {{ isSaving ? 'Saving…' : 'Save Changes' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-surface-300 dark:border-surface-700 px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer"
              @click="cancelEdit"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <!-- Delete confirmation dialog -->
      <Teleport to="body">
        <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="absolute inset-0 bg-black/50" @click="showDeleteConfirm = false" />
          <div class="relative bg-white dark:bg-surface-900 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2">Delete Candidate</h3>
            <p class="text-sm text-surface-600 dark:text-surface-400 mb-4">
              Are you sure you want to delete <strong>{{ candidate.firstName }} {{ candidate.lastName }}</strong>?
              This will also delete all their applications and documents. This action cannot be undone.
            </p>
            <div class="flex justify-end gap-2">
              <button
                :disabled="isDeleting"
                class="rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-1.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                @click="showDeleteConfirm = false"
              >
                Cancel
              </button>
              <button
                :disabled="isDeleting"
                class="rounded-lg bg-danger-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-danger-700 disabled:opacity-50 transition-colors cursor-pointer"
                @click="handleDelete"
              >
                {{ isDeleting ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>
