<script setup lang="ts">
import {
  ArrowLeft, ArrowRight, Briefcase, Calendar, Clock, Hash, UserRound, Mail, MessageSquare,
  FileText, Paperclip, Download, Eye, Phone, Search, ExternalLink,
  UserPlus, Pencil, Trash2, MoreHorizontal, Globe, ChevronDown, X,
  Video, Building2, Code2, UsersRound, Save, Check, MapPin, Users, Plus,
  CheckCircle2, XCircle, AlertTriangle, ArrowUpDown, ListFilter,
  Maximize2, Minimize2, Github, Linkedin, Square, SquareCheckBig,
} from 'lucide-vue-next'
import { z } from 'zod'
import { usePreviewReadOnly } from '~/composables/usePreviewReadOnly'
import { JOB_STATUS_TRANSITIONS, INTERVIEW_STATUS_TRANSITIONS } from '~~/shared/status-transitions'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

const route = useRoute()
const localePath = useLocalePath()
const jobId = route.params.id as string
const { handlePreviewReadOnlyError } = usePreviewReadOnly()
const { track } = useTrack()

// ─────────────────────────────────────────────
// Job data (with update/delete support)
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

const PIPELINE_STATUSES = computed(() => pipelineStages.value.map(s => s.id))
type PipelineStatus = string

const applications = computed(() => appData.value?.data ?? [])

// Read initial pipeline stage from URL query param (?stage=screening)
const initialStage: PipelineStatus = (route.query.stage as string) || 'new'
const focusStatus = ref<PipelineStatus>(initialStage)

const focusedApplications = computed(() =>
  applications.value.filter((application) => application.status === focusStatus.value),
)

// Search within the focused list
const searchTerm = ref('')

// ─────────────────────────────────────────────
// Filters & Sorting
// ─────────────────────────────────────────────

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'score-desc' | 'score-asc' | 'updated-desc'
type ScoreFilter = 'all' | 'high' | 'medium' | 'low' | 'none'
type InterviewFilter = 'all' | 'has-interview' | 'no-interview'

const sortBy = ref<SortOption>('date-desc')
const scoreFilter = ref<ScoreFilter>('all')
const interviewFilter = ref<InterviewFilter>('all')
const showSortPanel = ref(false)
const showFilterPanel = ref(false)

const hasActiveFilters = computed(() => scoreFilter.value !== 'all' || interviewFilter.value !== 'all')
const activeFilterCount = computed(() => {
  let count = 0
  if (scoreFilter.value !== 'all') count++
  if (interviewFilter.value !== 'all') count++
  return count
})

function clearFilters() {
  scoreFilter.value = 'all'
  interviewFilter.value = 'all'
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'name-asc', label: 'Name A \u2192 Z' },
  { value: 'name-desc', label: 'Name Z \u2192 A' },
  { value: 'score-desc', label: 'Highest score' },
  { value: 'score-asc', label: 'Lowest score' },
  { value: 'updated-desc', label: 'Recently updated' },
]

const currentSortLabel = computed(() =>
  sortOptions.find(o => o.value === sortBy.value)?.label ?? 'Sort',
)

const scoreFilterOptions: { value: ScoreFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: '75+' },
  { value: 'medium', label: '40\u201374' },
  { value: 'low', label: '< 40' },
  { value: 'none', label: 'No score' },
]

const interviewFilterOptions: { value: InterviewFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'has-interview', label: 'Scheduled' },
  { value: 'no-interview', label: 'None' },
]

function selectSort(option: SortOption) {
  sortBy.value = option
  showSortPanel.value = false
}

function closePanels() {
  showSortPanel.value = false
  showFilterPanel.value = false
}

const filteredApplications = computed(() => {
  let result = focusedApplications.value

  // Text search
  if (searchTerm.value.trim()) {
    const term = searchTerm.value.toLowerCase()
    result = result.filter((app) => {
      const name = `${app.candidateFirstName} ${app.candidateLastName}`.toLowerCase()
      const email = (app.candidateEmail ?? '').toLowerCase()
      return name.includes(term) || email.includes(term)
    })
  }

  // Score filter
  if (scoreFilter.value !== 'all') {
    result = result.filter((app) => {
      switch (scoreFilter.value) {
        case 'high': return app.score != null && app.score >= 75
        case 'medium': return app.score != null && app.score >= 40 && app.score < 75
        case 'low': return app.score != null && app.score < 40
        case 'none': return app.score == null
        default: return true
      }
    })
  }

  // Interview filter
  if (interviewFilter.value !== 'all') {
    result = result.filter((app) => {
      const hasInterview = applicationsWithInterviews.value.has(app.id)
      return interviewFilter.value === 'has-interview' ? hasInterview : !hasInterview
    })
  }

  // Sorting
  return [...result].sort((a, b) => {
    switch (sortBy.value) {
      case 'date-desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'date-asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'name-asc': {
        const nameA = `${a.candidateFirstName} ${a.candidateLastName}`.toLowerCase()
        const nameB = `${b.candidateFirstName} ${b.candidateLastName}`.toLowerCase()
        return nameA.localeCompare(nameB)
      }
      case 'name-desc': {
        const nameA = `${a.candidateFirstName} ${a.candidateLastName}`.toLowerCase()
        const nameB = `${b.candidateFirstName} ${b.candidateLastName}`.toLowerCase()
        return nameB.localeCompare(nameA)
      }
      case 'score-desc':
        return (b.score ?? -1) - (a.score ?? -1)
      case 'score-asc':
        return (a.score ?? -1) - (b.score ?? -1)
      case 'updated-desc':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      default:
        return 0
    }
  })
})

const statusCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const s of pipelineStages.value) counts[s.id] = 0
  for (const app of applications.value) {
    counts[app.status] = (counts[app.status] ?? 0) + 1
  }
  return counts
})

const currentIndex = ref(0)

watch(focusedApplications, () => {
  if (focusedApplications.value.length === 0) {
    currentIndex.value = 0
    return
  }
  if (currentIndex.value >= focusedApplications.value.length) {
    currentIndex.value = focusedApplications.value.length - 1
  }
}, { immediate: true })

watch(focusStatus, () => {
  currentIndex.value = 0
  searchTerm.value = ''
  closePanels()
})

const currentSummary = computed(() => filteredApplications.value[currentIndex.value] ?? null)

// Detail tab for center panel
// 'overview' | 'interviews' | 'documents' use scroll-to-section; 'activity' is a proper tab switch
const detailTab = ref<'overview' | 'interviews' | 'documents' | 'activity'>('overview')

// Section refs for scroll-to navigation
const overviewRef = ref<HTMLElement | null>(null)
const interviewsRef = ref<HTMLElement | null>(null)
const documentsRef = ref<HTMLElement | null>(null)
const responsesRef = ref<HTMLElement | null>(null)
const detailScrollContainer = ref<HTMLElement | null>(null)

function scrollToSection(section: 'overview' | 'interviews' | 'documents' | 'activity') {
  detailTab.value = section
  if (section === 'activity') return // activity is a proper tab, not scroll-to-section
  const refs: Record<string, ReturnType<typeof ref<HTMLElement | null>>> = {
    overview: overviewRef,
    interviews: interviewsRef,
    documents: documentsRef,
  }
  const el = refs[section]?.value
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function handleDetailScroll() {
  if (detailTab.value === 'activity') return // don't update active tab while in activity view
  const container = detailScrollContainer.value
  if (!container) return
  const scrollTop = container.scrollTop
  const offset = 120 // offset to trigger slightly before section top

  const sections = [
    { id: 'documents' as const, el: documentsRef.value },
    { id: 'interviews' as const, el: interviewsRef.value },
    { id: 'overview' as const, el: overviewRef.value },
  ]

  for (const section of sections) {
    if (section.el && section.el.offsetTop - container.offsetTop <= scrollTop + offset) {
      detailTab.value = section.id
      return
    }
  }
  detailTab.value = 'overview'
}

// ─────────────────────────────────────────────
// Activity feed
// ─────────────────────────────────────────────

const activitySubTab = ref<'all' | 'comments' | 'tasks' | 'history'>('all')

const { data: authSession } = await authClient.useSession(useFetch)
const currentUserId = computed(() => authSession.value?.user?.id)

const { comments, total: commentsTotal, createComment, updateComment, deleteComment } = useComments({
  targetType: 'application',
  targetId: computed(() => currentApplicationId.value || undefined),
})

const { data: activityLogData } = useFetch('/api/activity-log', {
  key: computed(() => `activity-log-${currentApplicationId.value}`),
  query: computed(() => ({
    resourceType: 'application',
    resourceId: currentApplicationId.value,
    limit: 50,
  })),
  headers: useRequestHeaders(['cookie']),
  immediate: computed(() => !!currentApplicationId.value),
})
const activityItems = computed(() => activityLogData.value?.data ?? [])

const { tasks, openTasksCount, createTask, toggleTask, deleteTask } =
  useApplicationTasks(currentApplicationId)

// ─────────────────────────────────────────────
// Candidate links
// ─────────────────────────────────────────────

const currentCandidateId = computed(() => resolvedCurrentApplication.value?.candidate.id)
const {
  links: candidateLinks,
  isLoading: linksLoading,
  addLink,
  removeLink,
} = useCandidateLinks(currentCandidateId)

const showAddLink = ref(false)
const newLinkType = ref('github')
const newLinkUrl = ref('')
const isAddingLink = ref(false)
const addLinkError = ref<string | null>(null)

async function submitAddLink() {
  if (!newLinkUrl.value.trim()) return
  isAddingLink.value = true
  addLinkError.value = null
  try {
    await addLink({ type: newLinkType.value, url: newLinkUrl.value.trim() })
    showAddLink.value = false
    newLinkUrl.value = ''
    newLinkType.value = 'github'
  }
  catch (err: any) {
    addLinkError.value = err?.data?.statusMessage ?? 'Failed to add link'
  }
  finally {
    isAddingLink.value = false
  }
}

type FeedItem =
  | { kind: 'comment'; ts: string; data: typeof comments.value[0] }
  | { kind: 'task'; ts: string; data: typeof tasks.value[0] }
  | { kind: 'history'; ts: string; data: typeof activityItems.value[0] }

const feedAll = computed((): FeedItem[] => {
  const items: FeedItem[] = [
    ...comments.value.map(c => ({ kind: 'comment' as const, ts: c.createdAt, data: c })),
    ...tasks.value.map(t => ({ kind: 'task' as const, ts: t.createdAt, data: t })),
    ...activityItems.value.map(a => ({ kind: 'history' as const, ts: String(a.createdAt), data: a })),
  ]
  return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
})

const feedFiltered = computed(() => {
  const sub = activitySubTab.value
  if (sub === 'comments') return feedAll.value.filter(i => i.kind === 'comment')
  if (sub === 'tasks') return feedAll.value.filter(i => i.kind === 'task')
  if (sub === 'history') return feedAll.value.filter(i => i.kind === 'history')
  return feedAll.value
})

const commentBody = ref('')
const commentInputMode = ref<'comment' | 'task'>('comment')
const isSubmittingComment = ref(false)
const editingCommentId = ref<string | null>(null)
const editingCommentBody = ref('')

async function submitActivityInput() {
  const body = commentBody.value.trim()
  if (!body) return
  isSubmittingComment.value = true
  try {
    if (commentInputMode.value === 'task') {
      await createTask(body)
    } else {
      await createComment(body)
    }
    commentBody.value = ''
  } finally {
    isSubmittingComment.value = false
  }
}

async function saveEditComment(id: string) {
  const body = editingCommentBody.value.trim()
  if (!body) return
  await updateComment(id, body)
  editingCommentId.value = null
  editingCommentBody.value = ''
}

function formatActivityAction(action: string, metadata: Record<string, string> | null): string {
  if (action === 'status_changed' && metadata?.from && metadata?.to) {
    return `Moved ${stageLabel(metadata.from)} → ${stageLabel(metadata.to)}`
  }
  const labels: Record<string, string> = {
    updated: 'Application updated',
    created: 'Application created',
    document_uploaded: 'Document uploaded',
    interview_scheduled: 'Interview scheduled',
  }
  return labels[action] ?? action.replace(/_/g, ' ')
}

type SwipeDocument = {
  id: string
  type: 'resume' | 'cover_letter' | 'other'
  originalFilename: string
  mimeType: string
  createdAt: string | Date
}

type SwipeResponse = {
  id: string
  value: unknown
  question: {
    id: string
    label: string
    type: string
    options: string[] | null
  } | null
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
  responses: SwipeResponse[]
}

const currentApplicationId = ref('')

watch(currentSummary, (summary) => {
  if (!summary?.id) return
  currentApplicationId.value = summary.id
}, { immediate: true })

const {
  data: currentApplication,
  status: detailFetchStatus,
  execute: executeDetailFetch,
} = useFetch<SwipeApplicationDetail | null>(
  () => `/api/applications/${currentApplicationId.value}`,
  {
    key: computed(() => `pipeline-application-${currentApplicationId.value}`),
    immediate: false,
    headers: useRequestHeaders(['cookie']),
  },
)

// Cache the last successfully loaded detail so switching candidates doesn't flash a loading spinner
const cachedApplication = ref<SwipeApplicationDetail | null>(null)

const resolvedCurrentApplication = computed(() => {
  if (currentApplication.value && currentApplication.value.id === currentApplicationId.value) {
    return currentApplication.value
  }
  // Show cached (previous) data while the new detail is loading
  return cachedApplication.value
})

watch(currentApplication, (val) => {
  if (val && val.id === currentApplicationId.value) {
    cachedApplication.value = val
  }
})

watch(currentApplicationId, async (id) => {
  if (!id) return
  await executeDetailFetch()
}, { immediate: true })

useSeoMeta({
  title: computed(() =>
    jobData.value ? `Pipeline — ${jobData.value.title} — Reqcore` : 'Pipeline — Reqcore',
  ),
  robots: 'noindex, nofollow',
})

// ─────────────────────────────────────────────
// Application status transitions
// ─────────────────────────────────────────────


const transitionLabels: Record<string, string> = {
  new: 'Re-open',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Reject',
}

const transitionClasses: Record<string, string> = {
  new: 'border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800',
  screening: 'bg-info-600 text-white hover:bg-info-700',
  interview: 'bg-warning-600 text-white hover:bg-warning-700',
  offer: 'bg-success-600 text-white hover:bg-success-700',
  hired: 'bg-success-700 text-white hover:bg-success-800',
  rejected: 'bg-danger-600 text-white hover:bg-danger-700',
}


function formatResponseValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value ?? '—')
}

function formatDocumentType(value: SwipeDocument['type']) {
  if (value === 'cover_letter') return 'Cover Letter'
  if (value === 'resume') return 'Resume'
  return 'Other'
}

function getCandidateInitials(firstName?: string, lastName?: string) {
  const first = firstName?.trim().charAt(0) ?? ''
  const last = lastName?.trim().charAt(0) ?? ''
  return `${first}${last}`.toUpperCase() || 'C'
}

function timeAgo(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

function scoreClass(score: number) {
  if (score >= 75) return 'bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
  if (score >= 40) return 'bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400'
  return 'bg-danger-50 text-danger-700 dark:bg-danger-950 dark:text-danger-400'
}

const allowedTransitions = computed(() => {
  if (!currentSummary.value) return []
  return pipelineTransitions.value[currentSummary.value.status] ?? []
})

function isCurrentStatus(status: string) {
  return currentSummary.value?.status === status
}

function isStatusActionEnabled(status: string) {
  if (!currentSummary.value) return false
  if (isCurrentStatus(status)) return false
  return allowedTransitions.value.includes(status)
}

function isFocusStatus(status: PipelineStatus) {
  return focusStatus.value === status
}

function setFocusStatus(status: PipelineStatus) {
  focusStatus.value = status
}

function selectCandidate(index: number) {
  currentIndex.value = index
}

const isMutating = ref(false)
const statusError = ref<string | null>(null)

// ─────────────────────────────────────────────
// Transition modal + undo toast (Wave C)
// ─────────────────────────────────────────────

const transitionModal = ref<{ targetStatus: string; note: string } | null>(null)
const pendingUndo = ref<{ applicationId: string; fromStatus: string; toStatus: string } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | null = null

const isTerminalTransition = computed(() =>
  transitionModal.value
    ? (pipelineStages.value.find((s: any) => s.id === transitionModal.value!.targetStatus)?.terminal ?? false)
    : false
)

// Approval request modal for gated transitions
const approvalRequestModal = ref<{ targetStatus: string; note: string } | null>(null)
const isSubmittingApproval = ref(false)

function openTransitionModal(nextStatus: string) {
  const currentStatus = currentSummary.value?.status
  if (currentStatus && requiresApproval(currentStatus, nextStatus)) {
    approvalRequestModal.value = { targetStatus: nextStatus, note: '' }
  } else {
    transitionModal.value = { targetStatus: nextStatus, note: '' }
  }
}

async function submitApprovalRequest() {
  if (!approvalRequestModal.value || !currentSummary.value) return
  isSubmittingApproval.value = true
  try {
    await $fetch(`/api/applications/${currentSummary.value.id}/approval-requests`, {
      method: 'POST',
      body: {
        toStage: approvalRequestModal.value.targetStatus,
        note: approvalRequestModal.value.note.trim() || undefined,
      },
    })
    approvalRequestModal.value = null
    statusError.value = null
  }
  catch (err: any) {
    statusError.value = err?.data?.statusMessage ?? 'Failed to request approval'
  }
  finally {
    isSubmittingApproval.value = false
  }
}

async function confirmTransition() {
  if (!transitionModal.value || !currentSummary.value) return
  const { targetStatus, note } = transitionModal.value
  transitionModal.value = null
  await changeStatus(targetStatus, note)
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
// Interview scheduling sidebar
// ─────────────────────────────────────────────

const showInterviewSidebar = ref(false)
const interviewTargetApplication = ref<{ id: string; name: string } | null>(null)

function openInterviewScheduler() {
  if (!currentSummary.value) return
  interviewTargetApplication.value = {
    id: currentSummary.value.id,
    name: `${currentSummary.value.candidateFirstName} ${currentSummary.value.candidateLastName}`,
  }
  showInterviewSidebar.value = true
}

async function handleInterviewScheduled() {
  showInterviewSidebar.value = false
  const scheduledApplicationId = interviewTargetApplication.value?.id ?? currentSummary.value?.id
  interviewTargetApplication.value = null

  track('interview_scheduled')

  // Refresh the interviews list
  await refreshJobInterviews()

  // Transition the application status to 'interview' after scheduling
  if (currentSummary.value && currentSummary.value.status !== 'interview') {
    const allowed = pipelineTransitions.value[currentSummary.value.status] ?? []
    if (allowed.includes('interview')) {
      await changeStatus('interview')

      // Follow the candidate to the interview column so the user sees the scheduled interview
      if (scheduledApplicationId) {
        focusStatus.value = 'interview'
        await nextTick()
        const idx = filteredApplications.value.findIndex(a => a.id === scheduledApplicationId)
        if (idx !== -1) currentIndex.value = idx
      }
    }
  }
}

// ─────────────────────────────────────────────
// Interviews for this job
// ─────────────────────────────────────────────

const { data: jobInterviewsData, refresh: refreshJobInterviews } = useFetch<{ data: Interview[] }>('/api/interviews', {
  key: `pipeline-job-interviews-${jobId}`,
  query: { jobId, limit: 100 },
  headers: useRequestHeaders(['cookie']),
})

const jobInterviews = computed(() => jobInterviewsData.value?.data ?? [])

const currentApplicationInterviews = computed(() =>
  jobInterviews.value.filter(i => i.applicationId === currentApplicationId.value),
)

const applicationsWithInterviews = computed(() =>
  new Set(jobInterviews.value.map(i => i.applicationId)),
)

const interviewTypeIcons: Record<string, any> = {
  video: Video,
  phone: Phone,
  in_person: Building2,
  technical: Code2,
  panel: UsersRound,
  take_home: FileText,
}

const interviewTypeLabels: Record<string, string> = {
  video: 'Video',
  phone: 'Phone',
  in_person: 'In Person',
  technical: 'Technical',
  panel: 'Panel',
  take_home: 'Take Home',
}

const interviewStatusClasses: Record<string, string> = {
  scheduled: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-800',
  completed: 'bg-success-50 text-success-700 ring-success-200 dark:bg-success-950/50 dark:text-success-300 dark:ring-success-800',
  cancelled: 'bg-surface-100 text-surface-500 ring-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:ring-surface-700',
  no_show: 'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-950/50 dark:text-danger-300 dark:ring-danger-800',
}

function formatInterviewDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    + ' at '
    + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatInterviewDateTimeFull(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function isInterviewUpcoming(dateStr: string) {
  return new Date(dateStr) > new Date()
}

// ─────────────────────────────────────────────
// Interview inline editing
// ─────────────────────────────────────────────

type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

function getAllowedInterviewTransitions(status: string): InterviewStatus[] {
  return (INTERVIEW_STATUS_TRANSITIONS[status] ?? []) as InterviewStatus[]
}

const interviewTransitionClasses: Record<InterviewStatus, string> = {
  scheduled: 'border border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800',
  completed: 'bg-success-600 text-white hover:bg-success-700',
  cancelled: 'bg-surface-500 text-white hover:bg-surface-600',
  no_show: 'bg-danger-600 text-white hover:bg-danger-700',
}

const interviewTransitionLabels: Record<InterviewStatus, string> = {
  scheduled: 'Re-schedule',
  completed: 'Completed',
  cancelled: 'Cancel',
  no_show: 'No Show',
}

const interviewStatusIcons: Record<InterviewStatus, any> = {
  scheduled: Calendar,
  completed: CheckCircle2,
  cancelled: XCircle,
  no_show: AlertTriangle,
}

const expandedInterviewId = ref<string | null>(null)
const editingInterviewId = ref<string | null>(null)
const interviewEditForm = reactive({
  title: '',
  type: 'video' as string,
  location: '',
  notes: '',
  interviewers: [''] as string[],
})
const interviewEditErrors = ref<Record<string, string>>({})
const isInterviewSaving = ref(false)
const isInterviewTransitioning = ref(false)

// Reschedule state
const rescheduleInterviewId = ref<string | null>(null)
const rescheduleForm = reactive({
  date: '',
  time: '',
  duration: 60,
})
const isRescheduling = ref(false)
const rescheduleError = ref('')

function toggleInterviewExpand(id: string) {
  if (expandedInterviewId.value === id) {
    expandedInterviewId.value = null
    editingInterviewId.value = null
    rescheduleInterviewId.value = null
  } else {
    expandedInterviewId.value = id
    editingInterviewId.value = null
    rescheduleInterviewId.value = null
  }
}

function startInterviewEdit(iv: Interview) {
  editingInterviewId.value = iv.id
  interviewEditForm.title = iv.title
  interviewEditForm.type = iv.type
  interviewEditForm.location = iv.location ?? ''
  interviewEditForm.notes = iv.notes ?? ''
  interviewEditForm.interviewers = iv.interviewers?.length ? [...iv.interviewers] : ['']
  interviewEditErrors.value = {}
}

function cancelInterviewEdit() {
  editingInterviewId.value = null
  interviewEditErrors.value = {}
}

function addEditInterviewer() {
  interviewEditForm.interviewers.push('')
}

function removeEditInterviewer(idx: number) {
  interviewEditForm.interviewers.splice(idx, 1)
}

async function saveInterviewEdit() {
  interviewEditErrors.value = {}
  if (!interviewEditForm.title.trim()) {
    interviewEditErrors.value.title = 'Title is required'
    return
  }

  isInterviewSaving.value = true
  try {
    const filteredInterviewers = interviewEditForm.interviewers.filter(i => i.trim())
    await $fetch(`/api/interviews/${editingInterviewId.value}`, {
      method: 'PATCH',
      body: {
        title: interviewEditForm.title.trim(),
        type: interviewEditForm.type,
        location: interviewEditForm.location.trim() || null,
        notes: interviewEditForm.notes.trim() || null,
        interviewers: filteredInterviewers.length > 0 ? filteredInterviewers : null,
      },
    })
    editingInterviewId.value = null
    await refreshJobInterviews()
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    interviewEditErrors.value.submit = err?.data?.statusMessage ?? 'Failed to save changes'
  } finally {
    isInterviewSaving.value = false
  }
}

async function handleInterviewTransition(interviewId: string, newStatus: InterviewStatus) {
  isInterviewTransitioning.value = true
  try {
    await $fetch(`/api/interviews/${interviewId}`, {
      method: 'PATCH',
      body: { status: newStatus },
    })
    await refreshJobInterviews()
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    alert(err?.data?.statusMessage ?? 'Failed to update status')
  } finally {
    isInterviewTransitioning.value = false
  }
}

function openReschedule(iv: Interview) {
  rescheduleInterviewId.value = iv.id
  const d = new Date(iv.scheduledAt)
  rescheduleForm.date = d.toISOString().slice(0, 10)
  rescheduleForm.time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  rescheduleForm.duration = iv.duration
  rescheduleError.value = ''
}

function cancelReschedule() {
  rescheduleInterviewId.value = null
  rescheduleError.value = ''
}

async function handleReschedule() {
  rescheduleError.value = ''
  if (!rescheduleForm.date || !rescheduleForm.time) {
    rescheduleError.value = 'Date and time are required'
    return
  }

  isRescheduling.value = true
  try {
    const scheduledAt = new Date(`${rescheduleForm.date}T${rescheduleForm.time}`).toISOString()
    await $fetch(`/api/interviews/${rescheduleInterviewId.value}`, {
      method: 'PATCH',
      body: {
        scheduledAt,
        duration: rescheduleForm.duration,
        status: 'scheduled',
      },
    })
    rescheduleInterviewId.value = null
    await refreshJobInterviews()
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    rescheduleError.value = err?.data?.statusMessage ?? 'Failed to reschedule'
  } finally {
    isRescheduling.value = false
  }
}

async function changeStatus(status: string, note?: string) {
  if (!currentSummary.value || isMutating.value) return
  const applicationId = currentSummary.value.id
  const previousStatus = currentSummary.value.status

  isMutating.value = true

  try {
    await $fetch(`/api/applications/${applicationId}`, {
      method: 'PATCH',
      body: { status },
    })

    // Post note as comment if provided
    if (note?.trim()) {
      await createComment(note.trim())
    }

    track('pipeline_stage_changed', {
      from_stage: previousStatus,
      to_stage: status,
    })

    await refreshApps()

    // After the moved candidate disappears from the list, the items that came after
    // it shift up by one index. currentIndex now naturally points to the next
    // candidate — no change needed. We only clamp if currentIndex is now out of
    // bounds (i.e. the moved candidate was the last item in the filtered list).
    const newLen = filteredApplications.value.length
    if (newLen > 0 && currentIndex.value >= newLen) {
      currentIndex.value = newLen - 1
    }

    // Show undo toast (8 seconds) for non-terminal transitions
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

function goToPreviousCard() {
  if (currentIndex.value === 0) return
  currentIndex.value -= 1
}

function goToNextCard() {
  if (currentIndex.value >= filteredApplications.value.length - 1) return
  currentIndex.value += 1
}

// ─────────────────────────────────────────────
// Fullscreen (focus) mode
// ─────────────────────────────────────────────
const isFullscreen = ref(false)
const pipelineContainer = useTemplateRef<HTMLElement>('pipelineContainer')
const teleportTarget = computed(() => isFullscreen.value && pipelineContainer.value ? pipelineContainer.value : 'body')

async function toggleFullscreen() {
  if (!isFullscreen.value) {
    isFullscreen.value = true
    await nextTick()
    pipelineContainer.value?.requestFullscreen?.()
  }
  else {
    isFullscreen.value = false
    if (document.fullscreenElement) {
      document.exitFullscreen?.()
    }
  }
}

function onFullscreenChange() {
  if (!document.fullscreenElement) {
    isFullscreen.value = false
  }
}

onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFullscreenChange))

function goToPreviousStage() {
  const statuses = PIPELINE_STATUSES.value
  const idx = statuses.indexOf(focusStatus.value)
  if (idx > 0) {
    focusStatus.value = statuses[idx - 1]!
  }
}

function goToNextStage() {
  const statuses = PIPELINE_STATUSES.value
  const idx = statuses.indexOf(focusStatus.value)
  if (idx < statuses.length - 1) {
    focusStatus.value = statuses[idx + 1]!
  }
}

function handleKeyNavigation(event: KeyboardEvent) {
  if (event.key === 'Escape' && showDocPreview.value) {
    closeDocPreview()
    return
  }

  if ((event.target as HTMLElement)?.tagName === 'INPUT' || (event.target as HTMLElement)?.tagName === 'TEXTAREA' || (event.target as HTMLElement)?.tagName === 'SELECT') return

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    goToPreviousCard()
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    goToNextCard()
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goToPreviousStage()
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    goToNextStage()
  }

  // Number keys 1-9 trigger status transition buttons
  const num = parseInt(event.key)
  if (num >= 1 && num <= 9 && allowedTransitions.value.length >= num) {
    event.preventDefault()
    const targetStatus = allowedTransitions.value[num - 1]!
    if (targetStatus === 'interview') {
      openInterviewScheduler()
    } else {
      changeStatus(targetStatus)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyNavigation)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyNavigation)
})

// ─────────────────────────────────────────────
// Job status transitions (Publish, Close, etc.)
// ─────────────────────────────────────────────

const jobStatusBadgeClasses: Record<string, string> = {
  draft: 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400',
  open: 'bg-success-50 dark:bg-success-950 text-success-700 dark:text-success-400',
  closed: 'bg-warning-50 dark:bg-warning-950 text-warning-700 dark:text-warning-400',
  archived: 'bg-surface-100 dark:bg-surface-800 text-surface-400',
}

const jobTransitionLabels: Record<string, string> = {
  draft: 'Revert to Draft',
  open: 'Publish',
  closed: 'Close',
  archived: 'Archive',
}

const jobTransitionClasses: Record<string, string> = {
  open: 'bg-success-600 text-white hover:bg-success-700',
  closed: 'bg-warning-600 text-white hover:bg-warning-700',
  draft: 'border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800',
  archived: 'border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800',
}

const allowedJobTransitions = computed(() => {
  if (!jobData.value) return []
  return JOB_STATUS_TRANSITIONS[jobData.value.status] ?? []
})

// The primary job action is the first forward transition (e.g., Publish for drafts)
const primaryJobTransition = computed(() => allowedJobTransitions.value[0] ?? null)
const secondaryJobTransitions = computed(() => allowedJobTransitions.value.slice(1))

const isJobTransitioning = ref(false)

async function handleJobTransition(newStatus: string) {
  isJobTransitioning.value = true
  try {
    await updateJob({ status: newStatus as any })
    await refreshJob()
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    alert(err.data?.statusMessage ?? 'Failed to update status')
  } finally {
    isJobTransitioning.value = false
  }
}

// ─────────────────────────────────────────────
// Edit Job modal
// ─────────────────────────────────────────────

const showEditModal = ref(false)
const editForm = ref({
  title: '',
  description: '',
  location: '',
  type: 'full_time' as string,
})

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
  showMoreMenu.value = false
}

function cancelEdit() {
  showEditModal.value = false
  editErrors.value = {}
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
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    alert(err.data?.statusMessage ?? 'Failed to save changes')
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
    alert(err.data?.statusMessage ?? 'Failed to delete job')
    isDeleting.value = false
    showDeleteConfirm.value = false
  }
}

// ─────────────────────────────────────────────
// Add candidate modal
// ─────────────────────────────────────────────

const showApplyModal = ref(false)

function handleCandidateApplied() {
  showApplyModal.value = false
  refreshApps()
}

// ─────────────────────────────────────────────
// More menu
// ─────────────────────────────────────────────

const showMoreMenu = ref(false)
const moreMenuRef = ref<HTMLElement | null>(null)

function handleClickOutside(event: MouseEvent) {
  if (moreMenuRef.value && !moreMenuRef.value.contains(event.target as Node)) {
    showMoreMenu.value = false
  }
}

watch(showMoreMenu, (val) => {
  if (val) {
    setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

const isLoading = computed(() => {
  return jobFetchStatus.value === 'pending' || appFetchStatus.value === 'pending'
})

// ─────────────────────────────────────────────
// Document preview
// ─────────────────────────────────────────────

const { getPreviewUrl } = useDocuments()

const showDocPreview = ref(false)
const docPreviewUrl = ref<string | null>(null)
const docPreviewFilename = ref('')
const docPreviewMimeType = ref('')
const docPreviewDocId = ref<string | null>(null)

const isDocPreviewPdf = computed(() => docPreviewMimeType.value === 'application/pdf')

function handleDocPreview(doc: SwipeDocument) {
  if (doc.mimeType !== 'application/pdf') {
    // Non-PDFs: fall back to download
    window.open(`/api/documents/${doc.id}/download`, '_blank')
    return
  }
  docPreviewDocId.value = doc.id
  docPreviewFilename.value = doc.originalFilename
  docPreviewMimeType.value = doc.mimeType
  docPreviewUrl.value = getPreviewUrl(doc.id)
  showDocPreview.value = true
}

function closeDocPreview() {
  showDocPreview.value = false
  docPreviewUrl.value = null
  docPreviewFilename.value = ''
  docPreviewMimeType.value = ''
  docPreviewDocId.value = null
}
</script>

<template>
  <div
    ref="pipelineContainer"
    :class="isFullscreen
      ? 'flex h-screen flex-col overflow-hidden bg-surface-50 dark:bg-surface-950'
      : '-mx-6 -my-8 flex h-screen flex-col overflow-hidden'"
  >
    <!-- Loading -->
    <div v-if="isLoading" class="flex flex-1 flex-col items-center justify-center gap-3">
      <div class="size-8 rounded-full border-2 border-brand-200 border-t-brand-600 dark:border-brand-800 dark:border-t-brand-400 animate-spin" />
      <p class="text-sm font-medium text-surface-400 dark:text-surface-500">Loading pipeline…</p>
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
        <div class="flex items-center gap-2">
          <!-- Add Candidate -->
          <button
            class="hidden sm:inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-surface-200 dark:border-surface-700/80 px-2.5 py-1 text-[11px] font-medium text-surface-600 dark:text-surface-300 hover:bg-white hover:border-surface-300 dark:hover:bg-surface-800 dark:hover:border-surface-600 transition-all duration-150"
            @click="showApplyModal = true"
          >
            <UserPlus class="size-3" />
            Add Candidate
          </button>

          <!-- Primary job action (e.g., Publish) -->
          <button
            v-if="primaryJobTransition"
            :disabled="isJobTransitioning"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="jobTransitionClasses[primaryJobTransition] ?? 'border border-surface-300 text-surface-600 hover:bg-surface-50'"
            @click="handleJobTransition(primaryJobTransition)"
          >
            {{ jobTransitionLabels[primaryJobTransition] ?? primaryJobTransition }}
          </button>

          <!-- More menu -->
          <div ref="moreMenuRef" class="relative">
            <button
              class="inline-flex cursor-pointer items-center justify-center rounded-md border border-surface-200 dark:border-surface-700/80 p-1 text-surface-500 hover:bg-white hover:text-surface-700 dark:hover:bg-surface-800 dark:hover:text-surface-300 transition-all duration-150"
              @click="showMoreMenu = !showMoreMenu"
            >
              <MoreHorizontal class="size-3.5" />
            </button>

            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 scale-95 -translate-y-1"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 -translate-y-1"
            >
              <div
                v-if="showMoreMenu"
                class="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-surface-200 dark:border-surface-700/80 bg-white dark:bg-surface-900 shadow-xl shadow-surface-900/5 dark:shadow-black/20 py-1.5 origin-top-right"
              >
                <button
                  class="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800/80 transition-colors"
                  @click="startEdit"
                >
                  <Pencil class="size-3.5 text-surface-400" />
                  Edit Job
                </button>
                <button
                  class="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800/80 transition-colors sm:hidden"
                  @click="showApplyModal = true; showMoreMenu = false"
                >
                  <UserPlus class="size-3.5 text-surface-400" />
                  Add Candidate
                </button>
                <template v-if="secondaryJobTransitions.length > 0">
                  <div class="border-t border-surface-100 dark:border-surface-800 my-1.5 mx-2" />
                  <button
                    v-for="t in secondaryJobTransitions"
                    :key="t"
                    :disabled="isJobTransitioning"
                    class="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800/80 transition-colors disabled:opacity-50"
                    @click="handleJobTransition(t); showMoreMenu = false"
                  >
                    {{ jobTransitionLabels[t] ?? t }}
                  </button>
                </template>
                <div class="border-t border-surface-100 dark:border-surface-800 my-1.5 mx-2" />
                <button
                  class="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/60 transition-colors"
                  @click="showDeleteConfirm = true; showMoreMenu = false"
                >
                  <Trash2 class="size-3.5" />
                  Delete Job
                </button>
              </div>
            </Transition>
          </div>

          <div class="hidden sm:flex items-center gap-2 text-[10px] font-medium text-surface-400 dark:text-surface-500">
            <div class="flex items-center gap-1 rounded-md bg-surface-100/80 px-2 py-0.5 dark:bg-surface-800/60">
              <span class="font-mono text-[10px]">↑↓</span>
              <span>candidates</span>
            </div>
            <div class="flex items-center gap-1 rounded-md bg-surface-100/80 px-2 py-0.5 dark:bg-surface-800/60">
              <span class="font-mono text-[10px]">←→</span>
              <span>stages</span>
            </div>
            <div class="flex items-center gap-1 rounded-md bg-surface-100/80 px-2 py-0.5 dark:bg-surface-800/60">
              <span class="font-mono text-[10px]">1-9</span>
              <span>actions</span>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Breadcrumb -->
      <div class="shrink-0 border-b border-surface-100 bg-white px-5 py-2.5 dark:border-surface-800/60 dark:bg-surface-900">
        <AppBreadcrumb :items="[
          { label: 'Jobs', to: $localePath('/dashboard/jobs') },
          { label: jobData?.title ?? '…' },
        ]" />
      </div>

      <!-- ═══════════════════════════════════════ -->
      <!-- PIPELINE STATUS TABS                     -->
      <!-- ═══════════════════════════════════════ -->
      <div class="shrink-0 border-b border-surface-200/80 bg-white dark:border-surface-800/60 dark:bg-surface-900">
        <div class="flex items-center gap-1 overflow-x-auto px-5 py-2">
          <button
            v-for="status in PIPELINE_STATUSES"
            :key="`tab-${status}`"
            class="relative flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 focus:outline-none"
            :class="isFocusStatus(status)
              ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-200/60 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-800/40'
              : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800/60 dark:hover:text-surface-200'"
            @click="setFocusStatus(status)"
          >
            <span class="pipeline-status-dot size-2 rounded-full" :class="stageColorClass(status, 'dot')" />
            {{ stageLabel(status) }}
            <span
              class="inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors duration-200"
              :class="isFocusStatus(status)
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300'
                : 'bg-surface-100 text-surface-500 dark:bg-surface-800/80 dark:text-surface-400'"
            >
              {{ statusCounts[status] ?? 0 }}
            </span>
          </button>

          <!-- Fullscreen toggle -->
          <button
            class="ml-auto flex shrink-0 cursor-pointer items-center justify-center rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:text-surface-500 dark:hover:bg-surface-800 dark:hover:text-surface-300 transition-all duration-200 focus:outline-none"
            :title="isFullscreen ? 'Exit focus mode (Esc)' : 'Focus mode'"
            @click="toggleFullscreen"
          >
            <Minimize2 v-if="isFullscreen" class="size-4" />
            <Maximize2 v-else class="size-4" />
          </button>
        </div>
      </div>

      <!-- ═══════════════════════════════════════ -->
      <!-- THREE-PANEL LAYOUT                       -->
      <!-- ═══════════════════════════════════════ -->
      <div class="flex flex-1 overflow-hidden">

        <!-- LEFT PANEL — Candidate list -->
        <div class="flex w-72 shrink-0 flex-col border-r border-surface-200/80 bg-white dark:border-surface-800/60 dark:bg-surface-900">
          <!-- Search + Sort + Filter controls -->
          <div class="shrink-0 px-3.5 pt-3 pb-2 space-y-2 dark:border-surface-800">
            <!-- Search input -->
            <div class="relative">
              <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-surface-400 dark:text-surface-500" />
              <input
                v-model="searchTerm"
                type="text"
                placeholder="Search candidates…"
                class="w-full rounded-lg border border-surface-200/80 bg-surface-50/80 py-2 pl-8 pr-3 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-700/80 dark:bg-surface-800/60 dark:text-surface-100 dark:placeholder:text-surface-500 dark:focus:border-brand-500 dark:focus:ring-brand-500/20 transition-all duration-150"
                @focus="closePanels"
              />
            </div>

            <!-- Sort & Filter row -->
            <div class="flex items-center gap-1.5">
              <!-- Sort dropdown -->
              <div class="relative flex-1 min-w-0">
                <button
                  class="flex w-full cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-all duration-150"
                  :class="showSortPanel
                    ? 'border-brand-300 bg-brand-50/50 text-brand-700 dark:border-brand-600 dark:bg-brand-950/30 dark:text-brand-300'
                    : 'border-surface-200/80 bg-surface-50/50 text-surface-600 hover:border-surface-300 hover:bg-surface-50 dark:border-surface-700/80 dark:bg-surface-800/40 dark:text-surface-300 dark:hover:border-surface-600 dark:hover:bg-surface-800'"
                  @click="showSortPanel = !showSortPanel; showFilterPanel = false"
                >
                  <ArrowUpDown class="size-3 shrink-0" />
                  <span class="truncate text-[11px] font-medium">{{ currentSortLabel }}</span>
                  <ChevronDown class="ml-auto size-3 shrink-0 transition-transform duration-150" :class="showSortPanel ? 'rotate-180' : ''" />
                </button>

                <!-- Sort dropdown panel -->
                <Transition
                  enter-active-class="transition duration-150 ease-out"
                  enter-from-class="opacity-0 scale-95 -translate-y-1"
                  enter-to-class="opacity-100 scale-100 translate-y-0"
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="opacity-100 scale-100 translate-y-0"
                  leave-to-class="opacity-0 scale-95 -translate-y-1"
                >
                  <div
                    v-if="showSortPanel"
                    class="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-surface-200 bg-white py-1 shadow-lg shadow-surface-900/5 dark:border-surface-700 dark:bg-surface-900 dark:shadow-black/20 origin-top"
                  >
                    <button
                      v-for="option in sortOptions"
                      :key="option.value"
                      class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[11px] font-medium transition-colors"
                      :class="sortBy === option.value
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'text-surface-600 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800'"
                      @click="selectSort(option.value)"
                    >
                      <Check v-if="sortBy === option.value" class="size-3 shrink-0" />
                      <span v-else class="size-3 shrink-0" />
                      {{ option.label }}
                    </button>
                  </div>
                </Transition>
              </div>

              <!-- Filter button -->
              <button
                class="relative flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1.5 transition-all duration-150"
                :class="showFilterPanel || hasActiveFilters
                  ? 'border-brand-300 bg-brand-50/50 text-brand-700 dark:border-brand-600 dark:bg-brand-950/30 dark:text-brand-300'
                  : 'border-surface-200/80 bg-surface-50/50 text-surface-600 hover:border-surface-300 hover:bg-surface-50 dark:border-surface-700/80 dark:bg-surface-800/40 dark:text-surface-300 dark:hover:border-surface-600 dark:hover:bg-surface-800'"
                @click="showFilterPanel = !showFilterPanel; showSortPanel = false"
              >
                <ListFilter class="size-3" />
                <span
                  v-if="activeFilterCount > 0"
                  class="flex size-3.5 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white dark:bg-brand-500"
                >
                  {{ activeFilterCount }}
                </span>
              </button>
            </div>

            <!-- Filter panel -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div
                v-if="showFilterPanel"
                class="rounded-lg border border-surface-200/80 bg-surface-50/80 p-2.5 space-y-2.5 dark:border-surface-700/80 dark:bg-surface-800/40"
              >
                <!-- Score filter -->
                <div>
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-1">Score</p>
                  <div class="flex flex-wrap gap-1">
                    <button
                      v-for="opt in scoreFilterOptions"
                      :key="opt.value"
                      class="cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-150"
                      :class="scoreFilter === opt.value
                        ? 'bg-brand-600 text-white shadow-sm dark:bg-brand-500'
                        : 'bg-white text-surface-600 ring-1 ring-inset ring-surface-200 hover:bg-surface-50 dark:bg-surface-800 dark:text-surface-300 dark:ring-surface-700 dark:hover:bg-surface-700'"
                      @click="scoreFilter = opt.value"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                </div>

                <!-- Interview filter -->
                <div>
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-1">Interview</p>
                  <div class="flex flex-wrap gap-1">
                    <button
                      v-for="opt in interviewFilterOptions"
                      :key="opt.value"
                      class="cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-150"
                      :class="interviewFilter === opt.value
                        ? 'bg-brand-600 text-white shadow-sm dark:bg-brand-500'
                        : 'bg-white text-surface-600 ring-1 ring-inset ring-surface-200 hover:bg-surface-50 dark:bg-surface-800 dark:text-surface-300 dark:ring-surface-700 dark:hover:bg-surface-700'"
                      @click="interviewFilter = opt.value"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                </div>

                <!-- Clear filters -->
                <button
                  v-if="hasActiveFilters"
                  class="flex w-full cursor-pointer items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 transition-colors"
                  @click="clearFilters"
                >
                  <X class="size-3" />
                  Clear filters
                </button>
              </div>
            </Transition>
          </div>

          <!-- Count bar -->
          <div class="shrink-0 px-3.5 pb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-surface-500 dark:text-surface-400">
              {{ filteredApplications.length }} candidate{{ filteredApplications.length === 1 ? '' : 's' }}
              <span v-if="searchTerm.trim() || hasActiveFilters" class="text-surface-400 dark:text-surface-500">
                {{ hasActiveFilters ? ' filtered' : ' matching' }}
              </span>
            </span>
            <span v-if="hasActiveFilters && filteredApplications.length !== focusedApplications.length" class="text-[10px] text-surface-400 dark:text-surface-500">
              of {{ focusedApplications.length }}
            </span>
          </div>

          <!-- Scrollable list -->
          <div class="flex-1 overflow-y-auto border-t border-surface-100 dark:border-surface-800/60">
            <div v-if="filteredApplications.length === 0" class="p-8 text-center">
              <div class="flex size-12 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-800/60 mx-auto mb-3">
                <UserRound class="size-5 text-surface-400 dark:text-surface-500" />
              </div>
              <p class="text-sm font-medium text-surface-600 dark:text-surface-300">
                {{ (searchTerm.trim() || hasActiveFilters) ? 'No matching candidates' : `No candidates yet` }}
              </p>
              <p class="mt-1 text-xs text-surface-400 dark:text-surface-500">
                {{ (searchTerm.trim() || hasActiveFilters) ? 'Try adjusting your search or filters.' : `No one in ${stageLabel(focusStatus)} stage.` }}
              </p>
              <button
                v-if="hasActiveFilters"
                class="mt-2 cursor-pointer text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                @click="clearFilters"
              >
                Clear filters
              </button>
            </div>

            <button
              v-for="(app, idx) in filteredApplications"
              :key="app.id"
              class="pipeline-candidate-card group flex w-full cursor-pointer items-start gap-3 px-3.5 py-3 text-left transition-all duration-150"
              :class="currentIndex === idx
                ? 'bg-brand-50/70 dark:bg-brand-950/20 border-l-[3px] border-l-brand-500 dark:border-l-brand-400'
                : 'border-l-[3px] border-l-transparent hover:bg-surface-50/80 dark:hover:bg-surface-800/40'"
              @click="selectCandidate(idx)"
            >
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-150"
                :class="currentIndex === idx
                  ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/20 dark:bg-brand-600 dark:shadow-brand-500/10'
                  : 'bg-surface-100 text-surface-600 group-hover:bg-brand-100 group-hover:text-brand-700 dark:bg-surface-800 dark:text-surface-300 dark:group-hover:bg-brand-950 dark:group-hover:text-brand-300'"
              >
                {{ getCandidateInitials(app.candidateFirstName, app.candidateLastName) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-surface-900 dark:text-surface-100">
                  {{ app.candidateFirstName }} {{ app.candidateLastName }}
                </p>
                <p class="mt-0.5 block truncate text-xs text-surface-500 dark:text-surface-400">{{ app.candidateEmail }}</p>
                <div class="mt-1.5 flex items-center gap-2">
                  <span
                    v-if="app.score != null"
                    class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
                    :class="{
                      'bg-success-50 text-success-700 ring-success-200 dark:bg-success-950/60 dark:text-success-400 dark:ring-success-800': app.score >= 75,
                      'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-950/60 dark:text-warning-400 dark:ring-warning-800': app.score >= 40 && app.score < 75,
                      'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-950/60 dark:text-danger-400 dark:ring-danger-800': app.score < 40,
                    }"
                  >
                    {{ app.score }} pts
                  </span>
                  <span class="text-[11px] text-surface-400 dark:text-surface-500">{{ timeAgo(app.createdAt) }}</span>
                  <span v-if="applicationsWithInterviews.has(app.id)" class="inline-flex items-center text-warning-500 dark:text-warning-400" title="Interview scheduled">
                    <Calendar class="size-3" />
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- CENTER PANEL — Candidate detail -->
        <div class="flex flex-1 flex-col overflow-hidden">
          <!-- Empty state -->
          <div
            v-if="!currentSummary"
            class="flex flex-1 flex-col items-center justify-center p-8 text-center"
          >
            <div class="flex size-16 items-center justify-center rounded-2xl bg-surface-100 dark:bg-surface-800/60 mb-4">
              <UserRound class="size-7 text-surface-400 dark:text-surface-500" />
            </div>
            <p class="text-base font-semibold text-surface-700 dark:text-surface-200">
              No candidates in {{ stageLabel(focusStatus) }}
            </p>
            <p class="mt-1.5 text-sm text-surface-500 dark:text-surface-400 max-w-xs">
              Switch to another pipeline stage to review candidates.
            </p>
          </div>

          <template v-else>
            <!-- Sticky status transitions (stays visible on scroll) -->
            <div v-if="allowedTransitions.length > 0" class="shrink-0 border-b border-surface-200/80 bg-white/95 backdrop-blur-sm px-6 py-2.5 dark:border-surface-800/60 dark:bg-surface-900/95">
              <div class="mx-auto max-w-4xl flex flex-wrap items-center gap-2">
                <button
                  v-for="(nextStatus, idx) in allowedTransitions"
                  :key="nextStatus"
                  :disabled="isMutating"
                  class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm inline-flex items-center gap-1.5"
                  :class="transitionClasses[nextStatus] ?? 'border border-surface-300 text-surface-600 hover:bg-surface-50'"
                  @click="nextStatus === 'interview' ? openInterviewScheduler() : openTransitionModal(nextStatus)"
                >
                  {{ transitionLabels[nextStatus] ?? nextStatus }}
                  <kbd class="inline-flex items-center justify-center rounded px-1 py-0.5 text-[10px] font-mono leading-none opacity-60 bg-black/10 dark:bg-white/10 min-w-[16px]">{{ idx + 1 }}</kbd>
                </button>
              </div>
            </div>

            <!-- Scrollable container: header + tabs + content -->
            <div ref="detailScrollContainer" class="flex-1 overflow-y-auto" @scroll="handleDetailScroll">

            <!-- Candidate header -->
            <div class="border-b border-surface-200 bg-surface-50 px-6 py-6 dark:border-surface-800 dark:bg-surface-900/80">
              <div class="mx-auto max-w-4xl">
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-start gap-4 min-w-0">
                  <div class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-lg font-bold text-white shadow-lg shadow-brand-500/20 dark:from-brand-500 dark:to-brand-700 dark:shadow-brand-500/10">
                    {{ getCandidateInitials(currentSummary.candidateFirstName, currentSummary.candidateLastName) }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2.5">
                      <h2 class="text-xl font-semibold tracking-tight text-surface-900 dark:text-surface-50 truncate">
                        {{ currentSummary.candidateFirstName }} {{ currentSummary.candidateLastName }}
                      </h2>
                      <span
                        class="inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset"
                        :class="stageColorClass(currentSummary.status, 'badge')"
                      >
                        {{ stageLabel(currentSummary.status) }}
                      </span>
                    </div>
                    <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-surface-500 dark:text-surface-400">
                      <a
                        :href="`mailto:${currentSummary.candidateEmail}`"
                        target="_blank"
                        class="inline-flex items-center gap-1.5 hover:text-brand-600 dark:hover:text-brand-400 hover:underline cursor-pointer transition-colors"
                      >
                        <Mail class="size-3.5" />
                        {{ currentSummary.candidateEmail }}
                      </a>
                      <span v-if="resolvedCurrentApplication?.candidate.phone" class="inline-flex items-center gap-1.5">
                        <Phone class="size-3.5" />
                        {{ resolvedCurrentApplication.candidate.phone }}
                      </span>
                    </div>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        v-if="currentSummary.score != null"
                        class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
                        :class="{
                          'bg-success-50 text-success-700 ring-success-200 dark:bg-success-950/60 dark:text-success-400 dark:ring-success-800': currentSummary.score >= 75,
                          'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-950/60 dark:text-warning-400 dark:ring-warning-800': currentSummary.score >= 40 && currentSummary.score < 75,
                          'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-950/60 dark:text-danger-400 dark:ring-danger-800': currentSummary.score < 40,
                        }"
                      >
                        {{ currentSummary.score }} pts
                      </span>
                      <span class="inline-flex items-center gap-1 text-[11px] text-surface-400 dark:text-surface-500">
                        <Clock class="size-3" />
                        Applied {{ new Date(currentSummary.createdAt).toLocaleDateString() }}
                      </span>
                      <span v-if="currentSummary.updatedAt !== currentSummary.createdAt" class="inline-flex items-center gap-1 text-[11px] text-surface-400 dark:text-surface-500">
                        · Updated {{ new Date(currentSummary.updatedAt).toLocaleDateString() }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <div class="flex items-center gap-1.5 mr-2">
                    <button
                      :disabled="currentIndex === 0"
                      class="flex cursor-pointer items-center justify-center rounded-lg border border-surface-200 p-1.5 text-surface-500 transition-all duration-150 hover:bg-white hover:border-surface-300 hover:text-surface-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:border-surface-600 dark:hover:text-surface-300"
                      @click="goToPreviousCard"
                    >
                      <ArrowLeft class="size-4" />
                    </button>
                    <span class="text-xs font-medium text-surface-500 dark:text-surface-400 tabular-nums px-0.5">
                      {{ currentIndex + 1 }}/{{ filteredApplications.length }}
                    </span>
                    <button
                      :disabled="currentIndex >= filteredApplications.length - 1"
                      class="flex cursor-pointer items-center justify-center rounded-lg border border-surface-200 p-1.5 text-surface-500 transition-all duration-150 hover:bg-white hover:border-surface-300 hover:text-surface-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:border-surface-600 dark:hover:text-surface-300"
                      @click="goToNextCard"
                    >
                      <ArrowRight class="size-4" />
                    </button>
                  </div>
                  <NuxtLink
                    :to="$localePath(`/dashboard/applications/${currentSummary.id}`)"
                    class="flex items-center justify-center rounded-lg border border-surface-200 p-1.5 text-surface-500 transition-all duration-150 hover:bg-white hover:border-surface-300 hover:text-surface-700 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:border-surface-600 dark:hover:text-surface-300"
                    title="Full application page"
                  >
                    <ExternalLink class="size-4" />
                  </NuxtLink>
                </div>
              </div>
              </div>
            </div>

            <!-- Detail tabs (scroll-to-section navigation) -->
            <div class="border-b border-surface-200/80 bg-white px-6 dark:border-surface-800/60 dark:bg-surface-900">
              <div class="mx-auto max-w-4xl flex gap-1 -mb-px">
                <button
                  class="cursor-pointer px-3.5 py-2.5 text-sm font-medium transition-all duration-150 border-b-2"
                  :class="detailTab === 'overview'
                    ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                    : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300 dark:text-surface-400 dark:hover:text-surface-300 dark:hover:border-surface-600'"
                  @click="scrollToSection('overview')"
                >
                  Profile
                </button>
                <button
                  class="cursor-pointer px-3.5 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 -mb-px"
                  :class="detailTab === 'interviews'
                    ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                    : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300 dark:text-surface-400 dark:hover:text-surface-300 dark:hover:border-surface-600'"
                  @click="scrollToSection('interviews')"
                >
                  Interviews
                  <span
                    v-if="currentApplicationInterviews.length > 0"
                    class="ml-1 text-xs text-surface-400"
                  >
                    ({{ currentApplicationInterviews.length }})
                  </span>
                </button>
                <button
                  class="cursor-pointer px-3.5 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 -mb-px"
                  :class="detailTab === 'documents'
                    ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                    : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300 dark:text-surface-400 dark:hover:text-surface-300 dark:hover:border-surface-600'"
                  @click="scrollToSection('documents')"
                >
                  Documents
                  <span
                    v-if="resolvedCurrentApplication?.candidate.documents?.length"
                    class="ml-1 text-xs text-surface-400"
                  >
                    ({{ resolvedCurrentApplication.candidate.documents.length }})
                  </span>
                </button>
                <button
                  class="cursor-pointer px-3.5 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 -mb-px inline-flex items-center gap-1.5"
                  :class="detailTab === 'activity'
                    ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                    : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300 dark:text-surface-400 dark:hover:text-surface-300 dark:hover:border-surface-600'"
                  @click="scrollToSection('activity')"
                >
                  Activity
                  <span
                    v-if="commentsTotal + openTasksCount > 0"
                    class="inline-flex min-w-[18px] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-semibold"
                    :class="detailTab === 'activity'
                      ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300'
                      : 'bg-surface-100 text-surface-500 dark:bg-surface-800/80 dark:text-surface-400'"
                  >
                    {{ commentsTotal + openTasksCount }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Activity feed (shown when activity tab is active) -->
            <div v-if="detailTab === 'activity'">
              <!-- Unified input -->
              <div class="border-b border-surface-200/80 bg-white px-6 py-3 dark:border-surface-800/60 dark:bg-surface-900">
                <div class="mx-auto max-w-4xl">
                  <div class="flex items-start gap-2.5">
                    <textarea
                      v-model="commentBody"
                      rows="1"
                      placeholder="Write a comment…"
                      class="flex-1 resize-none rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 placeholder:text-surface-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400/30 dark:border-surface-700 dark:bg-surface-800/60 dark:text-surface-200 dark:placeholder:text-surface-500 dark:focus:border-brand-500 dark:focus:bg-surface-800 dark:focus:ring-brand-500/20"
                      @keydown.enter.exact.prevent="submitActivityInput"
                    />
                    <button
                      :disabled="!commentBody.trim() || isSubmittingComment"
                      class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                      @click="submitActivityInput"
                    >
                      <MessageSquare class="size-3.5" />
                      Comment
                    </button>
                  </div>
                </div>
              </div>

              <!-- Sub-tabs -->
              <div class="border-b border-surface-100 bg-white px-6 dark:border-surface-800/60 dark:bg-surface-900">
                <div class="mx-auto max-w-4xl flex gap-0.5">
                  <button
                    v-for="sub in ['all', 'comments', 'tasks', 'history'] as const"
                    :key="sub"
                    class="cursor-pointer px-3 py-2 text-xs font-medium capitalize transition-all border-b-2"
                    :class="activitySubTab === sub
                      ? 'border-brand-500 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                      : 'border-transparent text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300'"
                    @click="activitySubTab = sub"
                  >
                    {{ sub }}
                  </button>
                </div>
              </div>

              <!-- Feed items -->
              <div class="px-6 py-4">
                <div class="mx-auto max-w-4xl space-y-3">
                  <!-- Empty state -->
                  <div v-if="feedFiltered.length === 0" class="py-12 text-center">
                    <div class="flex size-10 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-800/60 mx-auto mb-2.5">
                      <MessageSquare class="size-4.5 text-surface-400 dark:text-surface-500" />
                    </div>
                    <p class="text-sm text-surface-500 dark:text-surface-400">No activity yet.</p>
                  </div>

                  <!-- Feed items -->
                  <div v-for="item in feedFiltered" :key="`feed-${item.kind}-${item.data.id}`">

                    <!-- Comment item -->
                    <div v-if="item.kind === 'comment'" class="flex gap-3">
                      <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                        {{ getCandidateInitials(item.data.authorName?.split(' ')[0], item.data.authorName?.split(' ')[1]) }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div v-if="editingCommentId === item.data.id" class="flex gap-2">
                          <textarea
                            v-model="editingCommentBody"
                            rows="2"
                            class="flex-1 resize-none rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
                            @keydown.enter.exact.prevent="saveEditComment(item.data.id)"
                            @keydown.escape="editingCommentId = null"
                          />
                          <div class="flex flex-col gap-1">
                            <button class="cursor-pointer rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700" @click="saveEditComment(item.data.id)">Save</button>
                            <button class="cursor-pointer rounded-md border border-surface-200 px-2 py-1 text-xs text-surface-500 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800" @click="editingCommentId = null">Cancel</button>
                          </div>
                        </div>
                        <div v-else>
                          <div class="flex items-center gap-2 mb-0.5">
                            <span class="text-xs font-semibold text-surface-800 dark:text-surface-200">{{ item.data.authorName }}</span>
                            <span class="text-[11px] text-surface-400 dark:text-surface-500">{{ timeAgo(item.data.createdAt) }}</span>
                          </div>
                          <p class="text-sm leading-relaxed text-surface-700 dark:text-surface-300 whitespace-pre-wrap">{{ item.data.body }}</p>
                          <div v-if="item.data.authorId === currentUserId" class="mt-1 flex gap-2">
                            <button
                              class="cursor-pointer text-[11px] text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                              @click="editingCommentId = item.data.id; editingCommentBody = item.data.body"
                            >Edit</button>
                            <button
                              class="cursor-pointer text-[11px] text-danger-400 hover:text-danger-600 dark:hover:text-danger-300 transition-colors"
                              @click="deleteComment(item.data.id)"
                            >Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Task item -->
                    <div v-else-if="item.kind === 'task'" class="flex items-start gap-3">
                      <button
                        class="flex size-7 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer"
                        :class="item.data.completedAt
                          ? 'bg-success-100 dark:bg-success-950/40'
                          : 'bg-surface-100 dark:bg-surface-800 hover:bg-brand-50 dark:hover:bg-brand-950/30'"
                        @click="toggleTask(item.data.id, !item.data.completedAt)"
                      >
                        <SquareCheckBig v-if="item.data.completedAt" class="size-3.5 text-success-600 dark:text-success-400" />
                        <Square v-else class="size-3.5 text-surface-400 dark:text-surface-500" />
                      </button>
                      <div class="flex-1 min-w-0 pt-0.5">
                        <span
                          class="text-sm"
                          :class="item.data.completedAt
                            ? 'line-through text-surface-400 dark:text-surface-500'
                            : 'text-surface-700 dark:text-surface-300'"
                        >{{ item.data.title }}</span>
                        <div class="flex items-center gap-2 mt-0.5">
                          <span v-if="item.data.dueDate" class="text-[11px]" :class="!item.data.completedAt && new Date(item.data.dueDate) < new Date() ? 'text-danger-500' : 'text-surface-400 dark:text-surface-500'">
                            Due {{ timeAgo(item.data.dueDate) }}
                          </span>
                          <span class="text-[11px] text-surface-400 dark:text-surface-500">{{ timeAgo(item.data.createdAt) }}</span>
                          <button
                            class="cursor-pointer text-[11px] text-danger-400 hover:text-danger-600 dark:hover:text-danger-300 transition-colors"
                            @click="deleteTask(item.data.id)"
                          >Delete</button>
                        </div>
                      </div>
                    </div>

                    <!-- History item -->
                    <div v-else-if="item.kind === 'history'" class="flex items-start gap-3">
                      <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
                        <ArrowUpDown class="size-3.5 text-surface-400 dark:text-surface-500" />
                      </div>
                      <div class="flex-1 min-w-0 pt-0.5">
                        <span class="text-xs text-surface-600 dark:text-surface-400">{{ formatActivityAction(item.data.action, item.data.metadata as any) }}</span>
                        <span class="ml-2 text-[11px] text-surface-400 dark:text-surface-500">{{ timeAgo(String(item.data.createdAt)) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Detail content (non-activity tabs) -->
            <div v-else class="bg-surface-50/80 dark:bg-surface-950/80 px-6 py-8">
              <div v-if="detailFetchStatus === 'pending' && !resolvedCurrentApplication" class="flex flex-col items-center justify-center py-12">
                <div class="size-8 rounded-full border-2 border-brand-200 border-t-brand-600 dark:border-brand-800 dark:border-t-brand-400 animate-spin" />
                <p class="mt-3 text-sm text-surface-400">Loading details…</p>
              </div>

              <template v-else>

              <!-- PROFILE SECTION -->
              <div ref="overviewRef" class="space-y-5 max-w-4xl mx-auto scroll-mt-4">
                <!-- Notes -->
                <div class="rounded-xl border border-surface-200/80 bg-white p-5 shadow-sm shadow-surface-900/[0.03] dark:border-surface-800/60 dark:bg-surface-900 dark:shadow-none">
                  <div class="flex items-center gap-2.5 mb-4">
                    <div class="flex size-7 items-center justify-center rounded-lg bg-warning-50 dark:bg-warning-950/40">
                      <MessageSquare class="size-3.5 text-warning-600 dark:text-warning-400" />
                    </div>
                    <h3 class="text-sm font-semibold text-surface-800 dark:text-surface-200">Notes</h3>
                  </div>
                  <p class="text-sm leading-relaxed text-surface-600 dark:text-surface-300 whitespace-pre-wrap">
                    {{ currentSummary.notes || 'No notes yet.' }}
                  </p>
                </div>

                <!-- Candidate links -->
                <div class="rounded-xl border border-surface-200/80 bg-white p-5 shadow-sm shadow-surface-900/[0.03] dark:border-surface-800/60 dark:bg-surface-900 dark:shadow-none">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-semibold text-surface-800 dark:text-surface-200">Links</h3>
                    <button
                      class="inline-flex cursor-pointer items-center gap-1 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium transition-colors"
                      @click="showAddLink = !showAddLink"
                    >
                      <Plus class="size-3" />
                      Add
                    </button>
                  </div>

                  <div v-if="linksLoading && !candidateLinks.length" class="text-xs text-surface-400">Loading…</div>
                  <div v-else-if="candidateLinks.length" class="flex flex-wrap gap-2 mb-2">
                    <div
                      v-for="link in candidateLinks"
                      :key="link.id"
                      class="inline-flex items-center gap-1.5 rounded-full border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-2.5 py-1 text-xs text-surface-700 dark:text-surface-300 group"
                    >
                      <component
                        :is="link.type === 'github' ? Github : link.type === 'linkedin' ? Linkedin : Globe"
                        class="size-3.5 shrink-0 text-surface-500 dark:text-surface-400"
                      />
                      <a
                        :href="link.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="max-w-[140px] truncate hover:text-brand-600 dark:hover:text-brand-400 hover:underline transition-colors"
                        :title="link.url"
                      >{{ link.label || link.url.replace(/^https?:\/\//, '').split('/')[0] }}</a>
                      <button
                        class="cursor-pointer text-surface-300 hover:text-danger-500 dark:text-surface-600 dark:hover:text-danger-400 transition-colors opacity-0 group-hover:opacity-100"
                        @click="removeLink(link.id)"
                      >
                        <X class="size-3" />
                      </button>
                    </div>
                  </div>
                  <p v-else-if="!showAddLink" class="text-xs text-surface-400 italic">No links yet.</p>

                  <div v-if="showAddLink" class="mt-2 space-y-2">
                    <div class="flex gap-2">
                      <select
                        v-model="newLinkType"
                        class="rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-2 py-1.5 text-xs text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500 shrink-0"
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
                        class="flex-1 min-w-0 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 px-2.5 py-1.5 text-xs text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        @keydown.enter.prevent="submitAddLink"
                      />
                    </div>
                    <p v-if="addLinkError" class="text-xs text-danger-600 dark:text-danger-400">{{ addLinkError }}</p>
                    <div class="flex gap-2">
                      <button
                        :disabled="isAddingLink || !newLinkUrl.trim()"
                        class="cursor-pointer rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        @click="submitAddLink"
                      >
                        {{ isAddingLink ? 'Adding…' : 'Add' }}
                      </button>
                      <button
                        class="cursor-pointer rounded-lg border border-surface-300 dark:border-surface-600 px-2.5 py-1.5 text-xs font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                        @click="showAddLink = false; addLinkError = null"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Quick links -->
                <div class="flex items-center gap-4 pt-1">
                  <NuxtLink
                    :to="$localePath(`/dashboard/applications/${currentSummary.id}`)"
                    class="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors group"
                  >
                    <ExternalLink class="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    Full application page
                  </NuxtLink>
                </div>
              </div>

              <!-- INTERVIEWS SECTION -->
              <div ref="interviewsRef" class="space-y-3 max-w-4xl mx-auto mt-10 scroll-mt-4">
                <div class="flex items-center justify-between mb-3">
                  <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200 flex items-center gap-2">
                    <Calendar class="size-4 text-surface-400 dark:text-surface-500" />
                    Interviews
                  </h2>
                  <button
                    class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-surface-200 dark:border-surface-700/80 px-2.5 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-300 hover:bg-white hover:border-surface-300 dark:hover:bg-surface-800 dark:hover:border-surface-600 transition-all duration-150"
                    @click="openInterviewScheduler"
                  >
                    <Plus class="size-3.5" />
                    Schedule Interview
                  </button>
                </div>

                <div v-if="currentApplicationInterviews.length > 0" class="space-y-3">
                  <div
                    v-for="iv in currentApplicationInterviews"
                    :key="iv.id"
                    class="rounded-xl border bg-white shadow-sm shadow-surface-900/[0.03] dark:bg-surface-900 dark:shadow-none transition-all duration-200"
                    :class="expandedInterviewId === iv.id
                      ? 'border-brand-300 dark:border-brand-700 shadow-md'
                      : 'border-surface-200/80 dark:border-surface-800/60 hover:border-surface-300 dark:hover:border-surface-700'"
                  >
                    <!-- Interview card header (always visible) -->
                    <button
                      class="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
                      @click="toggleInterviewExpand(iv.id)"
                    >
                      <div class="flex items-center gap-3.5 min-w-0">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/40">
                          <component :is="interviewTypeIcons[iv.type] ?? Calendar" class="size-4.5 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div class="min-w-0">
                          <p class="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">
                            {{ iv.title }}
                          </p>
                          <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                            {{ formatInterviewDateTime(iv.scheduledAt) }} · {{ iv.duration }} min · {{ interviewTypeLabels[iv.type] ?? iv.type }}
                          </p>
                          <div v-if="iv.googleCalendarEventId" class="mt-1">
                            <a
                              v-if="iv.googleCalendarEventLink"
                              :href="iv.googleCalendarEventLink"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                              @click.stop
                            >
                              <Calendar class="size-2.5" />
                              Google Calendar
                              <ExternalLink class="size-2" />
                            </a>
                            <span v-else class="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              <Calendar class="size-2.5" />
                              Google Calendar
                            </span>
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-2.5 shrink-0">
                        <span
                          class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset"
                          :class="interviewStatusClasses[iv.status] ?? 'bg-surface-100 text-surface-500 ring-surface-200'"
                        >
                          <component :is="interviewStatusIcons[iv.status as InterviewStatus] ?? Calendar" class="size-3" />
                          {{ iv.status === 'no_show' ? 'No Show' : iv.status }}
                        </span>
                        <ChevronDown
                          class="size-4 text-surface-400 transition-transform duration-200"
                          :class="{ 'rotate-180': expandedInterviewId === iv.id }"
                        />
                      </div>
                    </button>

                    <!-- Expanded interview detail -->
                    <div v-if="expandedInterviewId === iv.id" class="border-t border-surface-200/80 dark:border-surface-800/60">
                      <!-- Status transition buttons -->
                      <div v-if="getAllowedInterviewTransitions(iv.status).length > 0" class="px-5 pt-4 pb-2">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-[11px] font-medium text-surface-400 dark:text-surface-500 mr-1">Actions:</span>
                          <button
                            v-for="nextStatus in getAllowedInterviewTransitions(iv.status)"
                            :key="nextStatus"
                            :disabled="isInterviewTransitioning"
                            class="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                            :class="interviewTransitionClasses[nextStatus]"
                            @click.stop="nextStatus === 'scheduled' ? openReschedule(iv) : handleInterviewTransition(iv.id, nextStatus)"
                          >
                            {{ interviewTransitionLabels[nextStatus] }}
                          </button>
                        </div>
                      </div>

                      <!-- Reschedule form (inline) -->
                      <div v-if="rescheduleInterviewId === iv.id" class="px-5 py-4 border-t border-surface-100 dark:border-surface-800/60">
                        <h4 class="text-xs font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-1.5">
                          <Calendar class="size-3.5" />
                          Reschedule Interview
                        </h4>
                        <div class="grid grid-cols-3 gap-3">
                          <div>
                            <label class="block text-[11px] font-medium text-surface-500 dark:text-surface-400 mb-1">Date</label>
                            <input
                              v-model="rescheduleForm.date"
                              type="date"
                              class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2.5 py-1.5 text-sm text-surface-900 dark:text-surface-100 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                              @click.stop
                            />
                          </div>
                          <div>
                            <label class="block text-[11px] font-medium text-surface-500 dark:text-surface-400 mb-1">Time</label>
                            <input
                              v-model="rescheduleForm.time"
                              type="time"
                              class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2.5 py-1.5 text-sm text-surface-900 dark:text-surface-100 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                              @click.stop
                            />
                          </div>
                          <div>
                            <label class="block text-[11px] font-medium text-surface-500 dark:text-surface-400 mb-1">Duration (min)</label>
                            <input
                              v-model.number="rescheduleForm.duration"
                              type="number"
                              min="5"
                              max="480"
                              class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2.5 py-1.5 text-sm text-surface-900 dark:text-surface-100 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                              @click.stop
                            />
                          </div>
                        </div>
                        <p v-if="rescheduleError" class="mt-2 text-xs text-danger-600 dark:text-danger-400">{{ rescheduleError }}</p>
                        <div class="flex items-center justify-end gap-2 mt-3">
                          <button
                            class="cursor-pointer rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-1.5 text-xs font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                            @click.stop="cancelReschedule"
                          >
                            Cancel
                          </button>
                          <button
                            :disabled="isRescheduling"
                            class="cursor-pointer rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            @click.stop="handleReschedule"
                          >
                            {{ isRescheduling ? 'Saving…' : 'Reschedule' }}
                          </button>
                        </div>
                      </div>

                      <!-- Interview details / edit form -->
                      <div class="px-5 py-4">
                        <!-- View mode -->
                        <template v-if="editingInterviewId !== iv.id">
                          <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            <div>
                              <dt class="text-[11px] font-medium text-surface-400 dark:text-surface-500 mb-0.5">Date & Time</dt>
                              <dd class="text-surface-800 dark:text-surface-200 font-medium text-[13px]">
                                {{ formatInterviewDateTimeFull(iv.scheduledAt) }}
                              </dd>
                            </div>
                            <div>
                              <dt class="text-[11px] font-medium text-surface-400 dark:text-surface-500 mb-0.5">Duration</dt>
                              <dd class="text-surface-800 dark:text-surface-200 font-medium text-[13px] flex items-center gap-1.5">
                                <Clock class="size-3.5 text-surface-400" />
                                {{ iv.duration }} minutes
                              </dd>
                            </div>
                            <div>
                              <dt class="text-[11px] font-medium text-surface-400 dark:text-surface-500 mb-0.5">Type</dt>
                              <dd class="text-surface-800 dark:text-surface-200 font-medium text-[13px] flex items-center gap-1.5">
                                <component :is="interviewTypeIcons[iv.type] ?? Calendar" class="size-3.5 text-surface-400" />
                                {{ interviewTypeLabels[iv.type] ?? iv.type }}
                              </dd>
                            </div>
                            <div v-if="iv.location">
                              <dt class="text-[11px] font-medium text-surface-400 dark:text-surface-500 mb-0.5">Location</dt>
                              <dd class="text-surface-800 dark:text-surface-200 font-medium text-[13px] flex items-center gap-1.5">
                                <MapPin class="size-3.5 text-surface-400" />
                                {{ iv.location }}
                              </dd>
                            </div>
                            <div v-if="iv.interviewers?.length" class="col-span-2">
                              <dt class="text-[11px] font-medium text-surface-400 dark:text-surface-500 mb-0.5">Interviewers</dt>
                              <dd class="text-surface-800 dark:text-surface-200 font-medium text-[13px] flex items-center gap-1.5">
                                <Users class="size-3.5 text-surface-400" />
                                {{ iv.interviewers.join(', ') }}
                              </dd>
                            </div>
                            <div v-if="iv.notes" class="col-span-2">
                              <dt class="text-[11px] font-medium text-surface-400 dark:text-surface-500 mb-0.5">Notes</dt>
                              <dd class="text-surface-700 dark:text-surface-300 text-[13px] leading-relaxed whitespace-pre-wrap">
                                {{ iv.notes }}
                              </dd>
                            </div>
                            <div v-if="iv.googleCalendarEventId" class="col-span-2">
                              <dt class="text-[11px] font-medium text-surface-400 dark:text-surface-500 mb-0.5">Calendar Sync</dt>
                              <dd class="text-[13px]">
                                <a
                                  v-if="iv.googleCalendarEventLink"
                                  :href="iv.googleCalendarEventLink"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-emerald-700 dark:text-emerald-400 font-medium hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                                >
                                  <Calendar class="size-3.5" />
                                  Open in Google Calendar
                                  <ExternalLink class="size-3" />
                                </a>
                                <span v-else class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-emerald-700 dark:text-emerald-400 font-medium">
                                  <Calendar class="size-3.5" />
                                  Synced to Google Calendar
                                </span>
                              </dd>
                            </div>
                          </dl>
                          <div class="flex items-center gap-3 mt-4 pt-3 border-t border-surface-100 dark:border-surface-800/60">
                            <button
                              class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                              @click.stop="startInterviewEdit(iv)"
                            >
                              <Pencil class="size-3" />
                              Edit Details
                            </button>
                            <NuxtLink
                              :to="$localePath(`/dashboard/interviews/${iv.id}`)"
                              class="inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300 transition-colors"
                              @click.stop
                            >
                              <ExternalLink class="size-3" />
                              Full Page
                            </NuxtLink>
                          </div>
                        </template>

                        <!-- Edit mode -->
                        <template v-else>
                          <div class="space-y-3">
                            <div>
                              <label class="block text-[11px] font-medium text-surface-500 dark:text-surface-400 mb-1">Title</label>
                              <input
                                v-model="interviewEditForm.title"
                                type="text"
                                class="w-full rounded-lg border px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
                                :class="interviewEditErrors.title ? 'border-danger-300 dark:border-danger-600' : 'border-surface-200 dark:border-surface-700'"
                                @click.stop
                              />
                              <p v-if="interviewEditErrors.title" class="mt-1 text-[11px] text-danger-600 dark:text-danger-400">{{ interviewEditErrors.title }}</p>
                            </div>

                            <div>
                              <label class="block text-[11px] font-medium text-surface-500 dark:text-surface-400 mb-1">Type</label>
                              <select
                                v-model="interviewEditForm.type"
                                class="w-full rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
                                @click.stop
                              >
                                <option value="video">Video Call</option>
                                <option value="phone">Phone</option>
                                <option value="in_person">In Person</option>
                                <option value="technical">Technical</option>
                                <option value="panel">Panel</option>
                                <option value="take_home">Take Home</option>
                              </select>
                            </div>

                            <div>
                              <label class="block text-[11px] font-medium text-surface-500 dark:text-surface-400 mb-1">Location / Link</label>
                              <input
                                v-model="interviewEditForm.location"
                                type="text"
                                placeholder="Zoom link, office address…"
                                class="w-full rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
                                @click.stop
                              />
                            </div>

                            <div>
                              <label class="block text-[11px] font-medium text-surface-500 dark:text-surface-400 mb-1">Notes</label>
                              <textarea
                                v-model="interviewEditForm.notes"
                                rows="3"
                                placeholder="Interview notes…"
                                class="w-full rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
                                @click.stop
                              />
                            </div>

                            <div>
                              <label class="block text-[11px] font-medium text-surface-500 dark:text-surface-400 mb-1.5">Interviewers</label>
                              <div class="space-y-2">
                                <div v-for="(_, idx) in interviewEditForm.interviewers" :key="idx" class="flex items-center gap-2">
                                  <input
                                    v-model="interviewEditForm.interviewers[idx]"
                                    type="text"
                                    placeholder="Name or email"
                                    class="flex-1 rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
                                    @click.stop
                                  />
                                  <button
                                    v-if="interviewEditForm.interviewers.length > 1"
                                    class="cursor-pointer rounded-md p-1 text-surface-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/40 transition-colors"
                                    @click.stop="removeEditInterviewer(idx)"
                                  >
                                    <X class="size-3.5" />
                                  </button>
                                </div>
                              </div>
                              <button
                                class="mt-2 inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                                @click.stop="addEditInterviewer"
                              >
                                <Plus class="size-3" />
                                Add interviewer
                              </button>
                            </div>

                            <p v-if="interviewEditErrors.submit" class="text-xs text-danger-600 dark:text-danger-400">{{ interviewEditErrors.submit }}</p>

                            <div class="flex items-center justify-end gap-2 pt-2">
                              <button
                                class="cursor-pointer rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-1.5 text-xs font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                                @click.stop="cancelInterviewEdit"
                              >
                                Cancel
                              </button>
                              <button
                                :disabled="isInterviewSaving"
                                class="cursor-pointer rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                @click.stop="saveInterviewEdit"
                              >
                                {{ isInterviewSaving ? 'Saving…' : 'Save Changes' }}
                              </button>
                            </div>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Empty state -->
                <div v-else class="rounded-xl border border-surface-200/80 bg-white p-10 text-center shadow-sm shadow-surface-900/[0.03] dark:border-surface-800/60 dark:bg-surface-900 dark:shadow-none">
                  <div class="flex size-14 items-center justify-center rounded-2xl bg-surface-100 dark:bg-surface-800/60 mx-auto mb-3">
                    <Calendar class="size-6 text-surface-400 dark:text-surface-500" />
                  </div>
                  <p class="text-sm font-medium text-surface-600 dark:text-surface-300">No interviews scheduled</p>
                  <p class="mt-1 text-xs text-surface-400 dark:text-surface-500">Schedule an interview to start the process.</p>
                  <button
                    class="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
                    @click="openInterviewScheduler"
                  >
                    <Plus class="size-3.5" />
                    Schedule Interview
                  </button>
                </div>
              </div>

              <!-- DOCUMENTS SECTION -->
              <div ref="documentsRef" class="space-y-3 max-w-4xl mx-auto mt-10 scroll-mt-4">
                <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200 flex items-center gap-2 mb-3">
                  <Paperclip class="size-4 text-surface-400 dark:text-surface-500" />
                  Documents
                </h2>
                <div v-if="resolvedCurrentApplication?.candidate.documents?.length" class="space-y-3">
                  <div
                    v-for="doc in resolvedCurrentApplication.candidate.documents"
                    :key="doc.id"
                    class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-200/80 bg-white px-5 py-4 shadow-sm shadow-surface-900/[0.03] dark:border-surface-800/60 dark:bg-surface-900 dark:shadow-none transition-colors hover:border-surface-300 dark:hover:border-surface-700"
                  >
                    <div class="flex items-center gap-3.5 min-w-0">
                      <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-800/60">
                        <FileText class="size-4.5 text-surface-500 dark:text-surface-400" />
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">
                          {{ doc.originalFilename }}
                        </p>
                        <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                          {{ formatDocumentType(doc.type) }} · {{ new Date(doc.createdAt).toLocaleDateString() }}
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        class="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 hover:border-surface-300 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:border-surface-600 transition-all duration-150"
                        @click="handleDocPreview(doc)"
                      >
                        <Eye class="size-3.5" />
                        Preview
                      </button>
                      <a
                        :href="`/api/documents/${doc.id}/download`"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 hover:border-surface-300 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:border-surface-600 transition-all duration-150"
                      >
                        <Download class="size-3.5" />
                        Download
                      </a>
                    </div>
                  </div>
                </div>
                <div v-else class="rounded-xl border border-surface-200/80 bg-white p-10 text-center shadow-sm shadow-surface-900/[0.03] dark:border-surface-800/60 dark:bg-surface-900 dark:shadow-none">
                  <div class="flex size-14 items-center justify-center rounded-2xl bg-surface-100 dark:bg-surface-800/60 mx-auto mb-3">
                    <FileText class="size-6 text-surface-400 dark:text-surface-500" />
                  </div>
                  <p class="text-sm font-medium text-surface-600 dark:text-surface-300">No documents uploaded</p>
                  <p class="mt-1 text-xs text-surface-400 dark:text-surface-500">Documents will appear here once uploaded.</p>
                </div>
              </div>

              <!-- RESPONSES SECTION -->
              <div v-if="resolvedCurrentApplication?.responses?.length" ref="responsesRef" class="space-y-3 max-w-4xl mx-auto mt-10 scroll-mt-4">
                <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200 flex items-center gap-2 mb-3">
                  <MessageSquare class="size-4 text-surface-400 dark:text-surface-500" />
                  Responses
                </h2>
                <div class="space-y-3">
                  <div
                    v-for="response in resolvedCurrentApplication.responses"
                    :key="response.id"
                    class="rounded-xl border border-surface-200/80 bg-white p-5 shadow-sm shadow-surface-900/[0.03] dark:border-surface-800/60 dark:bg-surface-900 dark:shadow-none"
                  >
                    <p class="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2">
                      {{ response.question?.label ?? 'Unknown question' }}
                    </p>
                    <p class="text-sm text-surface-700 dark:text-surface-200 leading-relaxed">
                      {{ formatResponseValue(response.value) }}
                    </p>
                  </div>
                </div>
              </div>

              </template>
            </div>
            </div>
          </template>
        </div>


      </div>
    </template>

    <!-- ═══════════════════════════════════════ -->
    <!-- MODALS                                   -->
    <!-- ═══════════════════════════════════════ -->

    <!-- Transition Confirmation Modal -->
    <Teleport :to="teleportTarget">
      <div v-if="transitionModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="!isTerminalTransition && (transitionModal = null)" />
        <div class="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl ring-1 ring-surface-200/80 dark:ring-surface-700/60 p-6 max-w-sm w-full mx-4">
          <h3 class="text-base font-semibold text-surface-900 dark:text-surface-100 mb-1">
            Move to {{ stageLabel(transitionModal.targetStatus) }}
          </h3>
          <p v-if="isTerminalTransition" class="mb-4 text-xs text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-950/40 rounded-lg px-3 py-2">
            This is a terminal stage. The candidate will be marked as {{ stageLabel(transitionModal.targetStatus) }}.
          </p>
          <p v-else class="mb-4 text-sm text-surface-500 dark:text-surface-400">
            Moving <span class="font-medium text-surface-800 dark:text-surface-200">{{ currentSummary?.candidateFirstName }} {{ currentSummary?.candidateLastName }}</span>.
          </p>

          <div class="mb-4">
            <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
              Note (optional — added as a comment)
            </label>
            <textarea
              v-model="transitionModal.note"
              rows="3"
              placeholder="Add context about this transition…"
              class="w-full resize-none rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 placeholder:text-surface-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400/30 dark:border-surface-700 dark:bg-surface-800/60 dark:text-surface-200 dark:placeholder:text-surface-500"
            />
          </div>

          <div class="flex gap-2.5">
            <button
              v-if="!isTerminalTransition"
              class="cursor-pointer rounded-lg border border-surface-200 px-3.5 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 transition-colors"
              @click="transitionModal = null"
            >
              Cancel
            </button>
            <button
              class="flex-1 cursor-pointer rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all"
              :class="isTerminalTransition
                ? 'bg-success-600 hover:bg-success-700'
                : 'bg-brand-600 hover:bg-brand-700'"
              @click="confirmTransition"
            >
              Move to {{ stageLabel(transitionModal.targetStatus) }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Approval Request Modal -->
    <Teleport :to="teleportTarget">
      <div v-if="approvalRequestModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="approvalRequestModal = null" />
        <div class="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl ring-1 ring-surface-200/80 dark:ring-surface-700/60 p-6 max-w-sm w-full mx-4">
          <h3 class="text-base font-semibold text-surface-900 dark:text-surface-100 mb-1">
            Request Approval
          </h3>
          <p class="mb-4 text-sm text-surface-500 dark:text-surface-400">
            Moving <span class="font-medium text-surface-800 dark:text-surface-200">{{ currentSummary?.candidateFirstName }} {{ currentSummary?.candidateLastName }}</span>
            to <span class="font-medium text-surface-800 dark:text-surface-200">{{ stageLabel(approvalRequestModal.targetStatus) }}</span>
            requires approval.
          </p>

          <div class="mb-4">
            <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
              Note (optional)
            </label>
            <textarea
              v-model="approvalRequestModal.note"
              rows="3"
              placeholder="Why should this transition be approved?"
              class="w-full resize-none rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 placeholder:text-surface-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400/30 dark:border-surface-700 dark:bg-surface-800/60 dark:text-surface-200 dark:placeholder:text-surface-500"
            />
          </div>

          <div class="flex gap-2.5">
            <button
              class="cursor-pointer rounded-lg border border-surface-200 px-3.5 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 transition-colors"
              @click="approvalRequestModal = null"
            >
              Cancel
            </button>
            <button
              :disabled="isSubmittingApproval"
              class="flex-1 cursor-pointer rounded-lg bg-warning-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-warning-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              @click="submitApprovalRequest"
            >
              {{ isSubmittingApproval ? 'Submitting…' : 'Request Approval' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit Job Modal -->
    <Teleport :to="teleportTarget">
      <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="cancelEdit" />
        <div class="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl shadow-surface-900/10 dark:shadow-black/30 ring-1 ring-surface-200/80 dark:ring-surface-700/60 p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
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
                class="w-full rounded-lg border px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                :class="editErrors.title ? 'border-danger-300' : 'border-surface-300 dark:border-surface-700'"
              />
              <p v-if="editErrors.title" class="mt-1 text-xs text-danger-600 dark:text-danger-400">{{ editErrors.title }}</p>
            </div>

            <div>
              <label for="edit-description" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Description
              </label>
              <textarea
                id="edit-description"
                v-model="editForm.description"
                rows="4"
                class="w-full rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
              />
            </div>

            <div>
              <label for="edit-location" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Location
              </label>
              <input
                id="edit-location"
                v-model="editForm.location"
                type="text"
                class="w-full rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
              />
            </div>

            <div>
              <label for="edit-type" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Employment Type
              </label>
              <select
                id="edit-type"
                v-model="editForm.type"
                class="w-full rounded-lg border border-surface-300 dark:border-surface-700 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors bg-white dark:bg-surface-800"
              >
                <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                class="cursor-pointer rounded-lg border border-surface-300 dark:border-surface-700 px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                @click="cancelEdit"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSaving"
                class="cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ isSaving ? 'Saving…' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Job Confirm -->
    <Teleport :to="teleportTarget">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showDeleteConfirm = false" />
        <div class="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl shadow-surface-900/10 dark:shadow-black/30 ring-1 ring-surface-200/80 dark:ring-surface-700/60 p-6 max-w-sm w-full mx-4">
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
              {{ isDeleting ? 'Deleting…' : 'Delete' }}
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

    <!-- Document Preview Modal -->
    <Teleport :to="teleportTarget">
      <div v-if="showDocPreview" class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeDocPreview" />
        <div class="relative flex flex-col bg-white dark:bg-surface-900 rounded-2xl shadow-2xl shadow-surface-900/10 dark:shadow-black/30 ring-1 ring-surface-200/80 dark:ring-surface-700/60 w-full max-w-4xl" style="height: calc(100vh - 3rem);">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-3 border-b border-surface-200/80 dark:border-surface-800/60 shrink-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <FileText class="size-4 text-surface-400 shrink-0" />
              <span class="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{{ docPreviewFilename }}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-4">
              <a
                v-if="docPreviewDocId"
                :href="`/api/documents/${docPreviewDocId}/download`"
                class="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 hover:border-surface-300 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800 transition-all duration-150"
              >
                <Download class="size-3.5" />
                Download
              </a>
              <button
                class="rounded-lg p-1.5 text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:hover:text-surface-300 dark:hover:bg-surface-800 transition-colors"
                title="Close"
                @click="closeDocPreview"
              >
                <X class="size-4" />
              </button>
            </div>
          </div>
          <!-- PDF viewer -->
          <iframe
            v-if="docPreviewUrl && isDocPreviewPdf"
            :src="docPreviewUrl"
            class="flex-1 w-full rounded-b-2xl min-h-0"
            title="Document preview"
          />
          <!-- Non-PDF fallback -->
          <div v-else class="flex-1 flex items-center justify-center p-8 text-center">
            <div>
              <FileText class="size-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
              <p class="text-sm font-medium text-surface-600 dark:text-surface-300">Preview not available for this file type</p>
              <a
                v-if="docPreviewDocId"
                :href="`/api/documents/${docPreviewDocId}/download`"
                class="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium"
              >
                <Download class="size-3.5" />
                Download instead
              </a>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
