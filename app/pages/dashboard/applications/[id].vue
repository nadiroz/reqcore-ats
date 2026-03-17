<script setup lang="ts">
import { User, Briefcase, Calendar, Clock, Hash, FileText, MessageSquare, Send, Pencil, Trash2, Globe, Github, Linkedin, X, ClipboardCheck, ChevronDown, ChevronUp, Save } from 'lucide-vue-next'
import type { AssessmentDecision } from '~~/shared/assessment-types'
import { usePreviewReadOnly } from '~/composables/usePreviewReadOnly'

const { stageColorClass } = usePipelineConfig()

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

const route = useRoute()
const applicationId = route.params.id as string
const { handlePreviewReadOnlyError } = usePreviewReadOnly()

const { application, status: fetchStatus, error, updateApplication } = useApplication(applicationId)

useSeoMeta({
  title: computed(() =>
    application.value
      ? `${application.value.candidate.firstName} ${application.value.candidate.lastName} → ${application.value.job.title} — Reqcore`
      : 'Application — Reqcore',
  ),
})

// ─────────────────────────────────────────────
// Status transitions
// ─────────────────────────────────────────────
import { APPLICATION_STATUS_TRANSITIONS } from '~~/shared/status-transitions'

const transitionLabels: Record<string, string> = {
  new: 'Re-open',
  screening: 'Send to Assessment',
  interview: 'Advance to Review',
  offer: 'Offer Trial',
  hired: 'Mark Hired',
  rejected: 'Reject',
}

const transitionClasses: Record<string, string> = {
  new: 'border border-surface-300 dark:border-surface-700 bg-white/80 dark:bg-surface-900 text-surface-700 dark:text-surface-300 hover:border-surface-400 dark:hover:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-800',
  screening: 'bg-info-600 text-white shadow-sm shadow-info-900/20 hover:bg-info-700',
  interview: 'bg-warning-600 text-white shadow-sm shadow-warning-900/20 hover:bg-warning-700',
  offer: 'bg-success-600 text-white shadow-sm shadow-success-900/20 hover:bg-success-700',
  hired: 'bg-success-700 text-white shadow-sm shadow-success-900/30 hover:bg-success-800',
  rejected: 'bg-danger-600 text-white shadow-sm shadow-danger-900/20 hover:bg-danger-700',
}

const allowedTransitions = computed(() => {
  if (!application.value) return []
  return APPLICATION_STATUS_TRANSITIONS[application.value.status] ?? []
})

const isTransitioning = ref(false)
const statusError = ref<string | null>(null)
const showInterviewSidebar = ref(false)

async function handleTransition(newStatus: string) {
  isTransitioning.value = true
  try {
    await updateApplication({ status: newStatus as any })
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    statusError.value = err.data?.statusMessage ?? 'Failed to update status'
    setTimeout(() => { statusError.value = null }, 6000)
  } finally {
    isTransitioning.value = false
  }
}

// ─────────────────────────────────────────────
// Notes editing
// ─────────────────────────────────────────────

const isEditingNotes = ref(false)
const notesInput = ref('')
const isSavingNotes = ref(false)

function startEditNotes() {
  notesInput.value = application.value?.notes ?? ''
  isEditingNotes.value = true
}

async function saveNotes() {
  isSavingNotes.value = true
  try {
    await updateApplication({ notes: notesInput.value || null })
    isEditingNotes.value = false
  } catch (err: any) {
    if (handlePreviewReadOnlyError(err)) return
    statusError.value = err.data?.statusMessage ?? 'Failed to save notes'
    setTimeout(() => { statusError.value = null }, 6000)
  } finally {
    isSavingNotes.value = false
  }
}

// ─────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────

const { data: session } = await authClient.useSession(useFetch)
const currentUserId = computed(() => session.value?.user?.id)

const { comments, total: commentsTotal, isLoading: commentsLoading, createComment, updateComment, deleteComment } = useComments({
  targetType: 'application',
  targetId: computed(() => applicationId),
})

const newCommentBody = ref('')
const isSubmittingComment = ref(false)
const editingCommentId = ref<string | null>(null)
const editingCommentBody = ref('')

async function submitComment() {
  const body = newCommentBody.value.trim()
  if (!body || isSubmittingComment.value) return
  isSubmittingComment.value = true
  try {
    await createComment(body)
    newCommentBody.value = ''
  } catch {
    // error handled in composable
  } finally {
    isSubmittingComment.value = false
  }
}

function startEditComment(id: string, body: string) {
  editingCommentId.value = id
  editingCommentBody.value = body
}

async function saveEditComment() {
  const id = editingCommentId.value
  const body = editingCommentBody.value.trim()
  if (!id || !body) return
  try {
    await updateComment(id, body)
    editingCommentId.value = null
    editingCommentBody.value = ''
  } catch {
    // error handled in composable
  }
}

async function handleDeleteComment(id: string) {
  try {
    await deleteComment(id)
  } catch {
    // error handled in composable
  }
}

// ─────────────────────────────────────────────
// Candidate links
// ─────────────────────────────────────────────

const { links: candidateLinks, isLoading: linksLoading, addLink, removeLink } = useCandidateLinks(
  computed(() => application.value?.candidate.id),
)

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

// ─────────────────────────────────────────────
// Assessment
// ─────────────────────────────────────────────

const {
  assessment,
  template: assessmentTemplate,
  isLoading: assessmentLoading,
  startAssessment,
  saveScores,
  saveBehavioralNotes,
  saveDecision,
  updateStatus,
  advanceToRound2,
} = useAssessment(applicationId)

const assessmentExpanded = ref(true)
const isSavingAssessment = ref(false)
const assessmentSaveError = ref<string | null>(null)

// Local score editing state
const localScores = ref<Record<string, { score: number; notes: string }[]>>({})
const localBehavioralNotes = ref('')
const localDecision = ref<AssessmentDecision>('pending')
const localTrainabilityNotes = ref('')

watch(assessment, (val) => {
  if (!val) return
  localBehavioralNotes.value = val.behavioralNotes ?? ''
  localDecision.value = (val.decision as AssessmentDecision) ?? 'pending'
  localTrainabilityNotes.value = val.trainabilityNotes ?? ''

  // Initialize local scores from existing
  const s: Record<string, { score: number; notes: string }[]> = {}
  if (val.scores?.round1?.tasks) {
    s.round1 = val.scores.round1.tasks.map(t => ({ score: t.score, notes: t.notes }))
  }
  if (val.scores?.round2?.tasks) {
    s.round2 = val.scores.round2.tasks.map(t => ({ score: t.score, notes: t.notes }))
  }
  localScores.value = s
}, { immediate: true })

function initLocalScoresForRound(roundKey: string, taskCount: number) {
  if (!localScores.value[roundKey]) {
    localScores.value[roundKey] = Array.from({ length: taskCount }, () => ({ score: 0, notes: '' }))
  }
}

async function handleSaveAssessment() {
  isSavingAssessment.value = true
  assessmentSaveError.value = null
  try {
    const scores: Record<string, { tasks: { score: number; notes: string }[] }> = {}
    if (localScores.value.round1) scores.round1 = { tasks: localScores.value.round1 }
    if (localScores.value.round2) scores.round2 = { tasks: localScores.value.round2 }

    await saveScores(scores)
    await saveBehavioralNotes(localBehavioralNotes.value || null)
    await saveDecision(localDecision.value, localTrainabilityNotes.value || null)
  }
  catch (err: any) {
    assessmentSaveError.value = err?.data?.statusMessage ?? 'Failed to save assessment.'
  }
  finally {
    isSavingAssessment.value = false
  }
}

async function handleStartAssessment() {
  isSavingAssessment.value = true
  assessmentSaveError.value = null
  try {
    await startAssessment()
  }
  catch (err: any) {
    assessmentSaveError.value = err?.data?.statusMessage ?? 'Failed to start assessment.'
  }
  finally {
    isSavingAssessment.value = false
  }
}

const assessmentStatusLabels: Record<string, string> = {
  not_started: 'Not Started',
  round1_sent: 'Round 1 Sent',
  round1_submitted: 'Round 1 Submitted',
  round1_evaluated: 'Round 1 Evaluated',
  round2_sent: 'Round 2 Sent',
  round2_submitted: 'Round 2 Submitted',
  completed: 'Completed',
}

const decisionLabels: Record<string, string> = {
  hire: 'Hire',
  no_hire: 'No Hire',
  borderline: 'Borderline',
  pending: 'Pending',
}

</script>

<template>
  <div class="mx-auto max-w-5xl">
    <!-- Breadcrumb -->
    <div class="mb-4">
      <AppBreadcrumb :items="[
        { label: 'Applications', to: $localePath('/dashboard/applications') },
        { label: application ? `${application.candidate.firstName} ${application.candidate.lastName}` : '…' },
      ]" />
    </div>

    <!-- Loading -->
    <div v-if="fetchStatus === 'pending'" class="text-center py-12 text-surface-400">
      Loading application…
    </div>

    <!-- Error / not found -->
    <div
      v-else-if="error"
      class="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700"
    >
      {{ error.statusCode === 404 ? 'Application not found.' : 'Failed to load application.' }}
      <NuxtLink :to="$localePath('/dashboard/applications')" class="underline ml-1">Back to Applications</NuxtLink>
    </div>

    <!-- Application detail -->
    <template v-else-if="application">
      <!-- Header card: name, job, status, transitions -->
      <div class="mb-5 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
        <!-- Candidate → Job -->
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <NuxtLink
            :to="$localePath(`/dashboard/candidates/${application.candidate.id}`)"
            class="text-2xl font-bold text-surface-900 dark:text-surface-50 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            {{ application.candidate.firstName }} {{ application.candidate.lastName }}
          </NuxtLink>
          <span class="text-surface-400 text-xl">→</span>
          <NuxtLink
            :to="$localePath(`/dashboard/jobs/${application.job.id}`)"
            class="text-xl text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors truncate"
          >
            {{ application.job.title }}
          </NuxtLink>
        </div>

        <!-- Status + date row -->
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <span
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
            :class="stageColorClass(application.status, 'badge')"
          >
            {{ application.status }}
          </span>
          <span class="text-sm text-surface-400">
            Applied {{ new Date(application.createdAt).toLocaleDateString() }}
          </span>
        </div>

        <!-- Transition buttons -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="nextStatus in allowedTransitions"
            :key="nextStatus"
            :disabled="isTransitioning"
            class="inline-flex cursor-pointer items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            :class="transitionClasses[nextStatus] ?? 'border border-surface-300 dark:border-surface-700 bg-white/80 dark:bg-surface-900 text-surface-700 dark:text-surface-300 hover:border-surface-400 dark:hover:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-800'"
            @click="handleTransition(nextStatus)"
          >
            <span
              class="mr-2 inline-flex size-1.5 rounded-full"
              :class="stageColorClass(nextStatus, 'dot')"
            />
            {{ transitionLabels[nextStatus] ?? nextStatus }}
          </button>
          <button
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-surface-300 dark:border-surface-700 bg-white/80 dark:bg-surface-900 px-3.5 py-1.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 hover:text-brand-700 dark:hover:text-brand-300 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            @click="showInterviewSidebar = true"
          >
            <Calendar class="size-3.5" />
            Schedule Interview
          </button>
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="grid gap-4 lg:grid-cols-3">
        <!-- Left: Notes + Responses + Comments -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Notes -->
          <div class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <MessageSquare class="size-4 text-surface-500 dark:text-surface-400" />
                <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">Notes</h2>
              </div>
              <button
                v-if="!isEditingNotes"
                class="cursor-pointer text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
                @click="startEditNotes"
              >
                {{ application.notes ? 'Edit' : 'Add Notes' }}
              </button>
            </div>

            <div v-if="isEditingNotes">
              <textarea
                v-model="notesInput"
                rows="4"
                placeholder="Add notes about this application…"
                class="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
              />
              <div class="flex items-center gap-2 mt-2">
                <button
                  :disabled="isSavingNotes"
                  class="cursor-pointer rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  @click="saveNotes"
                >
                  {{ isSavingNotes ? 'Saving…' : 'Save' }}
                </button>
                <button
                  class="cursor-pointer rounded-lg border border-surface-300 dark:border-surface-600 px-3 py-1.5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                  @click="isEditingNotes = false"
                >
                  Cancel
                </button>
              </div>
            </div>

            <p
              v-else-if="application.notes"
              class="text-sm text-surface-600 dark:text-surface-300 whitespace-pre-wrap"
            >
              {{ application.notes }}
            </p>
            <p v-else class="text-sm text-surface-400 italic">No notes yet.</p>
          </div>

          <!-- Assessment -->
          <div class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <ClipboardCheck class="size-4 text-brand-500 dark:text-brand-400" />
                <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">Assessment</h2>
                <span
                  v-if="assessment"
                  class="text-xs rounded-full px-2 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400"
                >{{ assessmentStatusLabels[assessment.status] ?? assessment.status }}</span>
              </div>
              <button
                v-if="assessment"
                class="text-surface-400 hover:text-surface-600 transition-colors"
                @click="assessmentExpanded = !assessmentExpanded"
              >
                <ChevronUp v-if="assessmentExpanded" class="size-4" />
                <ChevronDown v-else class="size-4" />
              </button>
            </div>

            <!-- No assessment yet -->
            <div v-if="!assessment && !assessmentLoading">
              <p class="text-sm text-surface-500 dark:text-surface-400 mb-3">
                No assessment started for this application.
                <span v-if="!assessmentTemplate"> No template configured for this job.</span>
              </p>
              <button
                v-if="assessmentTemplate"
                :disabled="isSavingAssessment"
                class="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                @click="handleStartAssessment"
              >
                {{ isSavingAssessment ? 'Starting…' : 'Start Assessment' }}
              </button>
            </div>

            <!-- Assessment scoring (expanded) -->
            <div v-else-if="assessment && assessmentExpanded">
              <!-- Score error -->
              <div v-if="assessmentSaveError" class="mb-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                {{ assessmentSaveError }}
              </div>

              <!-- Round scoring -->
              <div v-if="assessmentTemplate" class="space-y-4 mb-4">
                <div
                  v-for="(round, rIdx) in assessmentTemplate.config.rounds"
                  :key="rIdx"
                  class="rounded-lg border border-surface-100 dark:border-surface-800 p-3"
                >
                  <div class="flex items-center justify-between mb-2">
                    <h3 class="text-xs font-semibold text-surface-600 dark:text-surface-300">{{ round.label }}</h3>
                    <span
                      v-if="rIdx === 0 && assessment.currentRound === 1 && ['round1_submitted', 'round1_evaluated'].includes(assessment.status)"
                      class="text-[11px] text-brand-600 dark:text-brand-400"
                    >Ready to score</span>
                    <button
                      v-if="rIdx === 0 && assessment.currentRound === 1 && assessment.status === 'round1_evaluated'"
                      class="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium"
                      @click="advanceToRound2"
                    >Advance to Round 2</button>
                  </div>

                  <!-- Task scores -->
                  <div class="space-y-2">
                    <div
                      v-for="(task, tIdx) in round.tasks"
                      :key="tIdx"
                      class="flex items-start gap-3 py-2 border-b border-surface-50 dark:border-surface-800 last:border-0"
                    >
                      <!-- Make sure local scores array exists -->
                      {{ void initLocalScoresForRound(`round${rIdx + 1}`, round.tasks.length) }}
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-xs font-medium text-surface-700 dark:text-surface-300">{{ task.label }}</span>
                          <span class="text-[11px] text-surface-400">({{ task.weight }}%)</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <input
                          v-if="localScores[`round${rIdx + 1}`]?.[tIdx]"
                          v-model.number="localScores[`round${rIdx + 1}`][tIdx].score"
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          class="w-14 rounded border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-2 py-1 text-xs text-center text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <span class="text-[11px] text-surface-400">/ 10</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Overall score display -->
              <div v-if="assessment.overallScore != null" class="flex items-center gap-2 mb-3 p-2 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                <span class="text-xs font-medium text-surface-600 dark:text-surface-300">Weighted Score:</span>
                <span class="text-sm font-bold" :class="assessment.overallScore >= 7 ? 'text-success-600' : assessment.overallScore >= 5 ? 'text-warning-600' : 'text-danger-600'">
                  {{ assessment.overallScore.toFixed(1) }} / 10
                </span>
              </div>

              <!-- Behavioral notes -->
              <div class="mb-3">
                <label class="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1 block">Behavioral Notes</label>
                <textarea
                  v-model="localBehavioralNotes"
                  rows="2"
                  placeholder="Questions before starting, deadline adherence, communication style…"
                  class="w-full resize-none rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>

              <!-- Decision -->
              <div class="mb-3">
                <label class="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5 block">Decision</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="(label, key) in decisionLabels"
                    :key="key"
                    class="rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors"
                    :class="localDecision === key
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 dark:border-brand-700'
                      : 'border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 hover:border-surface-300 dark:hover:border-surface-600'"
                    @click="localDecision = key as AssessmentDecision"
                  >
                    {{ label }}
                  </button>
                </div>
              </div>

              <!-- Trainability notes (borderline) -->
              <div v-if="localDecision === 'borderline'" class="mb-3">
                <label class="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1 block">Trainability Notes</label>
                <textarea
                  v-model="localTrainabilityNotes"
                  rows="2"
                  placeholder="What skills are trainable? What is the gap size?"
                  class="w-full resize-none rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>

              <!-- Save -->
              <button
                :disabled="isSavingAssessment"
                class="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                @click="handleSaveAssessment"
              >
                <Save class="size-3.5" />
                {{ isSavingAssessment ? 'Saving…' : 'Save Assessment' }}
              </button>
            </div>
          </div>

          <!-- Application Responses -->
          <div
            v-if="application.responses && application.responses.length > 0"
            class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5"
          >
            <div class="flex items-center gap-2 mb-3">
              <FileText class="size-4 text-surface-500 dark:text-surface-400" />
              <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">
                Application Responses ({{ application.responses.length }})
              </h2>
            </div>
            <div class="space-y-3">
              <div
                v-for="response in application.responses"
                :key="response.id"
                class="border-b border-surface-100 dark:border-surface-800 pb-3 last:border-0 last:pb-0"
              >
                <dt class="text-xs font-medium text-surface-500 dark:text-surface-400 mb-0.5">
                  {{ response.question?.label ?? 'Unknown question' }}
                </dt>
                <dd class="text-sm text-surface-700 dark:text-surface-200">
                  {{ formatResponseValue(response.value) }}
                </dd>
              </div>
            </div>
          </div>

          <!-- Comments -->
          <div class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
            <div class="flex items-center gap-2 mb-4">
              <Hash class="size-4 text-surface-500 dark:text-surface-400" />
              <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">
                Comments
                <span v-if="commentsTotal > 0" class="ml-1.5 rounded-full bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 text-xs text-surface-500 dark:text-surface-400">{{ commentsTotal }}</span>
              </h2>
            </div>

            <!-- Comment list -->
            <div v-if="commentsLoading && comments.length === 0" class="text-sm text-surface-400 py-2">
              Loading comments…
            </div>
            <div v-else-if="comments.length === 0" class="text-sm text-surface-400 italic mb-4">
              No comments yet.
            </div>
            <div v-else class="space-y-3 mb-4">
              <div
                v-for="comment in comments"
                :key="comment.id"
                class="flex gap-3"
              >
                <div class="shrink-0 size-7 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-xs font-semibold text-brand-700 dark:text-brand-300">
                  {{ getCandidateInitials(comment.authorName?.split(' ')[0], comment.authorName?.split(' ')[1]) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-xs font-medium text-surface-700 dark:text-surface-200">{{ comment.authorName }}</span>
                    <span class="text-xs text-surface-400">{{ timeAgo(comment.createdAt) }}</span>
                    <template v-if="comment.authorId === currentUserId">
                      <button
                        class="ml-auto text-xs text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                        @click="startEditComment(comment.id, comment.body)"
                      >
                        <Pencil class="size-3" />
                      </button>
                      <button
                        class="text-xs text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                        @click="handleDeleteComment(comment.id)"
                      >
                        <Trash2 class="size-3" />
                      </button>
                    </template>
                  </div>
                  <div v-if="editingCommentId === comment.id" class="flex gap-2">
                    <textarea
                      v-model="editingCommentBody"
                      rows="2"
                      class="flex-1 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-none"
                    />
                    <div class="flex flex-col gap-1">
                      <button
                        class="rounded px-2 py-1 text-xs bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                        @click="saveEditComment"
                      >
                        Save
                      </button>
                      <button
                        class="rounded px-2 py-1 text-xs border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                        @click="editingCommentId = null"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <p v-else class="text-sm text-surface-600 dark:text-surface-300 whitespace-pre-wrap">{{ comment.body }}</p>
                </div>
              </div>
            </div>

            <!-- Add comment -->
            <div class="flex gap-2">
              <textarea
                v-model="newCommentBody"
                rows="2"
                placeholder="Add a comment…"
                class="flex-1 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-none"
                @keydown.ctrl.enter="submitComment"
              />
              <button
                :disabled="!newCommentBody.trim() || isSubmittingComment"
                class="shrink-0 self-end rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                @click="submitComment"
              >
                <Send class="size-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Right: Score, Status, Dates, Contact, Job -->
        <div class="space-y-4">
          <!-- Score + Status -->
          <div class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
            <div class="flex items-center gap-2 mb-3">
              <Hash class="size-4 text-surface-500 dark:text-surface-400" />
              <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">Overview</h2>
            </div>
            <dl class="space-y-3 text-sm">
              <div>
                <dt class="text-xs text-surface-400 mb-0.5">Score</dt>
                <dd class="text-3xl font-bold text-surface-900 dark:text-surface-50 tabular-nums">
                  {{ application.score ?? '—' }}<span v-if="application.score != null" class="text-base font-medium text-surface-400">/100</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs text-surface-400 mb-0.5">Stage</dt>
                <dd>
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                    :class="stageColorClass(application.status, 'badge')"
                  >
                    {{ application.status }}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <!-- Dates -->
          <div class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
            <div class="flex items-center gap-2 mb-3">
              <Calendar class="size-4 text-surface-500 dark:text-surface-400" />
              <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">Dates</h2>
            </div>
            <dl class="space-y-2 text-sm">
              <div class="flex items-center justify-between">
                <dt class="text-surface-400">Applied</dt>
                <dd class="text-surface-700 dark:text-surface-200 font-medium">{{ new Date(application.createdAt).toLocaleDateString() }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-surface-400">Updated</dt>
                <dd class="text-surface-700 dark:text-surface-200 font-medium">{{ new Date(application.updatedAt).toLocaleDateString() }}</dd>
              </div>
            </dl>
          </div>

          <!-- Candidate contact -->
          <div class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
            <div class="flex items-center gap-2 mb-3">
              <User class="size-4 text-surface-500 dark:text-surface-400" />
              <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">Candidate</h2>
            </div>
            <dl class="space-y-2 text-sm">
              <div>
                <dt class="text-xs text-surface-400 mb-0.5">Name</dt>
                <dd>
                  <NuxtLink
                    :to="$localePath(`/dashboard/candidates/${application.candidate.id}`)"
                    class="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
                  >
                    {{ application.candidate.firstName }} {{ application.candidate.lastName }}
                  </NuxtLink>
                </dd>
              </div>
              <div>
                <dt class="text-xs text-surface-400 mb-0.5">Email</dt>
                <dd>
                  <a
                    :href="`mailto:${application.candidate.email}`"
                    class="text-surface-700 dark:text-surface-200 hover:text-brand-600 dark:hover:text-brand-400 hover:underline transition-colors break-all"
                  >{{ application.candidate.email }}</a>
                </dd>
              </div>
              <div v-if="application.candidate.phone">
                <dt class="text-xs text-surface-400 mb-0.5">Phone</dt>
                <dd class="text-surface-700 dark:text-surface-200">{{ application.candidate.phone }}</dd>
              </div>
            </dl>
          </div>

          <!-- Links -->
          <div class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <Globe class="size-4 text-surface-500 dark:text-surface-400" />
                <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">Links</h2>
              </div>
              <button
                class="cursor-pointer text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium transition-colors"
                @click="showAddLink = !showAddLink"
              >
                + Add
              </button>
            </div>

            <div v-if="linksLoading && !candidateLinks.length" class="text-xs text-surface-400">Loading…</div>
            <div v-else-if="candidateLinks.length" class="flex flex-wrap gap-1.5 mb-2">
              <div
                v-for="link in candidateLinks"
                :key="link.id"
                class="inline-flex items-center gap-1.5 rounded-full border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-2.5 py-1 text-xs text-surface-700 dark:text-surface-300 group"
              >
                <component
                  :is="link.type === 'github' ? Github : link.type === 'linkedin' ? Linkedin : Globe"
                  class="size-3.5 shrink-0 text-surface-400"
                />
                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="max-w-[140px] truncate hover:text-brand-600 hover:underline transition-colors"
                  :title="link.url"
                >{{ link.label || link.url.replace(/^https?:\/\//, '').split('/')[0] }}</a>
                <button
                  class="cursor-pointer text-surface-300 hover:text-danger-500 transition-colors opacity-0 group-hover:opacity-100"
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
              <p v-if="addLinkError" class="text-xs text-danger-600">{{ addLinkError }}</p>
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

          <!-- Job -->
          <div class="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5">
            <div class="flex items-center gap-2 mb-3">
              <Briefcase class="size-4 text-surface-500 dark:text-surface-400" />
              <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">Job</h2>
            </div>
            <dl class="space-y-2 text-sm">
              <div>
                <dt class="text-xs text-surface-400 mb-0.5">Title</dt>
                <dd>
                  <NuxtLink
                    :to="$localePath(`/dashboard/jobs/${application.job.id}`)"
                    class="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
                  >
                    {{ application.job.title }}
                  </NuxtLink>
                </dd>
              </div>
              <div>
                <dt class="text-xs text-surface-400 mb-0.5">Status</dt>
                <dd class="text-surface-700 dark:text-surface-200 capitalize">{{ application.job.status }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </template>
  </div>

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

  <!-- Interview Schedule Sidebar -->
  <InterviewScheduleSidebar
    v-if="showInterviewSidebar && application"
    :application-id="applicationId"
    :candidate-name="`${application.candidate.firstName} ${application.candidate.lastName}`"
    :job-title="application.job.title"
    @close="showInterviewSidebar = false"
    @scheduled="showInterviewSidebar = false"
  />
</template>
