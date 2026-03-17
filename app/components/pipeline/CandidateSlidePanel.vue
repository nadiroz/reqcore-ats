<script setup lang="ts">
import {
  X, Mail, Phone, ExternalLink, Clock, Briefcase, Calendar,
  FileText, MessageSquare, ArrowUpDown, ChevronDown, Square, SquareCheckBig,
  Github, Linkedin, Globe, Plus, Paperclip,
} from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  application: {
    id: string
    candidateFirstName: string
    candidateLastName: string
    candidateEmail: string
    status: string
    score: number | null
    createdAt: string | Date
    updatedAt: string | Date
  } | null
  applicationDetail: {
    id: string
    candidate: {
      id: string
      phone: string | null
      documents: { id: string; type: string; originalFilename: string; mimeType: string; createdAt: string | Date }[]
    }
    responses: any[]
  } | null
  comments: any[]
  activityItems: any[]
  tasks: any[]
  interviews: any[]
  candidateLinks: any[]
  allowedTransitions: string[]
  isMutating: boolean
  isDetailLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'transition', status: string): void
  (e: 'open-interview-scheduler'): void
  (e: 'navigate-to-application', id: string): void
  (e: 'create-comment', body: string): void
  (e: 'create-task', title: string): void
  (e: 'toggle-task', id: string, completed: boolean): void
  (e: 'delete-task', id: string): void
  (e: 'delete-comment', id: string): void
  (e: 'update-comment', id: string, body: string): void
}>()

const { stageLabel, stageColorClass } = usePipelineConfig()

const timelineFilter = ref<'all' | 'comments' | 'documents' | 'interviews' | 'history'>('all')
const commentBody = ref('')
const inputMode = ref<'comment' | 'task'>('comment')
const isSubmitting = ref(false)

// Primary transition is the first non-reject, non-terminal
const primaryTransition = computed(() => {
  return props.allowedTransitions.find(s => s !== 'rejected') ?? null
})
const secondaryTransitions = computed(() => {
  return props.allowedTransitions.filter(s => s !== primaryTransition.value)
})

// Convert stage IDs to action verbs for transition buttons
function transitionVerb(stageId: string): string {
  const verbMap: Record<string, string> = {
    rejected: 'Reject',
    withdrawn: 'Withdraw',
    hired: 'Mark Hired',
    offer: 'Send Offer',
    interview: 'Schedule Interview',
  }
  if (verbMap[stageId]) return verbMap[stageId]!
  // Fall back: use stage label but strip past-tense -ed suffix
  const label = stageLabel(stageId)
  return label.replace(/ed$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
}

type FeedItem =
  | { kind: 'comment'; ts: string; data: any }
  | { kind: 'task'; ts: string; data: any }
  | { kind: 'document'; ts: string; data: any }
  | { kind: 'interview'; ts: string; data: any }
  | { kind: 'history'; ts: string; data: any }

const feedItems = computed((): FeedItem[] => {
  const items: FeedItem[] = [
    ...props.comments.map(c => ({ kind: 'comment' as const, ts: c.createdAt, data: c })),
    ...props.tasks.map(t => ({ kind: 'task' as const, ts: t.createdAt, data: t })),
    ...props.activityItems.map(a => ({ kind: 'history' as const, ts: String(a.createdAt), data: a })),
    ...(props.applicationDetail?.candidate.documents ?? []).map(d => ({ kind: 'document' as const, ts: String(d.createdAt), data: d })),
    ...props.interviews.map(i => ({ kind: 'interview' as const, ts: i.scheduledAt ?? i.createdAt, data: i })),
  ]
  return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
})

const filteredFeed = computed(() => {
  if (timelineFilter.value === 'all') return feedItems.value
  return feedItems.value.filter(item => {
    if (timelineFilter.value === 'comments') return item.kind === 'comment' || item.kind === 'task'
    if (timelineFilter.value === 'documents') return item.kind === 'document'
    if (timelineFilter.value === 'interviews') return item.kind === 'interview'
    if (timelineFilter.value === 'history') return item.kind === 'history'
    return true
  })
})

function formatActivityAction(action: string, metadata: Record<string, string> | null): string {
  if (action === 'status_changed' && metadata?.from && metadata?.to) {
    return `Moved ${stageLabel(metadata.from)} \u2192 ${stageLabel(metadata.to)}`
  }
  const labels: Record<string, string> = {
    updated: 'Application updated',
    created: 'Application created',
    document_uploaded: 'Document uploaded',
    interview_scheduled: 'Interview scheduled',
  }
  return labels[action] ?? action.replace(/_/g, ' ')
}

async function handleSubmit() {
  const body = commentBody.value.trim()
  if (!body) return
  isSubmitting.value = true
  try {
    if (inputMode.value === 'task') {
      emit('create-task', body)
    } else {
      emit('create-comment', body)
    }
    commentBody.value = ''
  } finally {
    isSubmitting.value = false
  }
}

const showTransitionDropdown = ref(false)
</script>

<template>
  <!-- Backdrop -->
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open && application"
      class="fixed inset-0 top-14 z-40 bg-surface-900/20 dark:bg-surface-950/40 lg:hidden"
      @click="emit('close')"
    />
  </Transition>

  <!-- Panel -->
  <Transition
    enter-active-class="transition duration-250 ease-out"
    enter-from-class="translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-x-0"
    leave-to-class="translate-x-full"
  >
    <div
      v-if="open && application"
      class="fixed right-0 top-14 z-50 flex w-full max-w-md flex-col border-l border-surface-200/80 bg-white shadow-2xl dark:border-surface-800/60 dark:bg-surface-900 lg:relative lg:top-auto lg:z-auto lg:h-full lg:shadow-none"
      style="height: calc(100vh - 3.5rem - 2.5rem);"
    >
      <!-- Summary card (sticky top) -->
      <div class="shrink-0 border-b border-surface-200/80 dark:border-surface-800/60 p-4">
        <!-- Close + open full page -->
        <div class="flex items-center justify-between mb-3">
          <button
            class="flex cursor-pointer items-center gap-1 text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
            @click="emit('navigate-to-application', application.id)"
          >
            <ExternalLink class="size-3" />
            Open full page
          </button>
          <button
            class="flex cursor-pointer items-center justify-center rounded-md p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800 dark:hover:text-surface-300 transition-colors"
            @click="emit('close')"
          >
            <X class="size-4" />
          </button>
        </div>

        <!-- Candidate info -->
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
            {{ getCandidateInitials(application.candidateFirstName, application.candidateLastName) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-semibold text-surface-900 dark:text-surface-50 truncate">
                {{ application.candidateFirstName }} {{ application.candidateLastName }}
              </h3>
              <span
                class="inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset"
                :class="stageColorClass(application.status, 'badge')"
              >
                {{ stageLabel(application.status) }}
              </span>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-surface-500 dark:text-surface-400">
              <a :href="`mailto:${application.candidateEmail}`" class="inline-flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                <Mail class="size-3" />
                {{ application.candidateEmail }}
              </a>
              <span v-if="applicationDetail?.candidate.phone" class="inline-flex items-center gap-1">
                <Phone class="size-3" />
                {{ applicationDetail.candidate.phone }}
              </span>
            </div>
            <div class="mt-1.5 flex items-center gap-2">
              <span
                v-if="application.score != null"
                class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset"
                :class="scoreBadgeClass(application.score)"
              >
                {{ application.score }} pts
              </span>
              <span class="text-[11px] text-surface-400 dark:text-surface-500">
                <Clock class="inline size-3" />
                {{ timeAgo(application.createdAt) }}
              </span>
              <span v-if="applicationDetail?.candidate.documents?.length" class="text-[11px] text-surface-400 dark:text-surface-500">
                <Paperclip class="inline size-3" />
                {{ applicationDetail.candidate.documents.length }} doc{{ applicationDetail.candidate.documents.length === 1 ? '' : 's' }}
              </span>
            </div>

            <!-- Links -->
            <div v-if="candidateLinks.length" class="mt-2 flex flex-wrap gap-1.5">
              <a
                v-for="link in candidateLinks"
                :key="link.id"
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 rounded-full border border-surface-200 dark:border-surface-700 px-2 py-0.5 text-[10px] text-surface-600 dark:text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                <component
                  :is="link.type === 'github' ? Github : link.type === 'linkedin' ? Linkedin : Globe"
                  class="size-3"
                />
                {{ link.label || link.type }}
              </a>
            </div>
          </div>
        </div>

        <!-- Transition actions -->
        <div v-if="allowedTransitions.length > 0" class="mt-3 flex items-center gap-2">
          <button
            v-if="primaryTransition"
            :disabled="isMutating"
            class="flex-1 cursor-pointer rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            @click="primaryTransition === 'interview' ? emit('open-interview-scheduler') : emit('transition', primaryTransition)"
          >
            Advance to {{ stageLabel(primaryTransition) }}
          </button>

          <!-- Dropdown for other transitions -->
          <div v-if="secondaryTransitions.length > 0" class="relative">
            <button
              class="flex cursor-pointer items-center justify-center rounded-lg border border-surface-200 dark:border-surface-700 p-1.5 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              @click="showTransitionDropdown = !showTransitionDropdown"
            >
              <ChevronDown class="size-3.5" />
            </button>
            <div
              v-if="showTransitionDropdown"
              class="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-surface-200 bg-white py-1 shadow-lg dark:border-surface-700 dark:bg-surface-900"
            >
              <button
                v-for="status in secondaryTransitions"
                :key="status"
                :disabled="isMutating"
                class="flex w-full cursor-pointer items-center px-3 py-1.5 text-xs font-medium transition-colors"
                :class="status === 'rejected'
                  ? 'text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-950/40'
                  : 'text-surface-700 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800'"
                @click="emit('transition', status); showTransitionDropdown = false"
              >
                {{ transitionVerb(status) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline filter chips -->
      <div class="shrink-0 border-b border-surface-100 dark:border-surface-800/60 px-4">
        <div class="flex gap-0.5 -mb-px">
          <button
            v-for="filter in ['all', 'comments', 'documents', 'interviews', 'history'] as const"
            :key="filter"
            class="cursor-pointer px-2.5 py-2 text-[11px] font-medium capitalize transition-all border-b-2"
            :class="timelineFilter === filter
              ? 'border-brand-500 text-brand-700 dark:border-brand-400 dark:text-brand-300'
              : 'border-transparent text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300'"
            @click="timelineFilter = filter"
          >
            {{ filter }}
          </button>
        </div>
      </div>

      <!-- Timeline (scrollable) -->
      <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div v-if="isDetailLoading && !filteredFeed.length" class="flex items-center justify-center py-8">
          <div class="size-6 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
        </div>

        <div v-else-if="filteredFeed.length === 0" class="py-8 text-center">
          <p class="text-xs text-surface-400">No activity yet.</p>
        </div>

        <template v-else>
          <div v-for="item in filteredFeed" :key="`${item.kind}-${item.data.id}`">
            <!-- Comment -->
            <div v-if="item.kind === 'comment'" class="flex gap-2.5">
              <div class="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {{ getCandidateInitials(item.data.authorName?.split(' ')[0], item.data.authorName?.split(' ')[1]) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-0.5">
                  <span class="text-[11px] font-semibold text-surface-800 dark:text-surface-200">{{ item.data.authorName }}</span>
                  <span class="text-[10px] text-surface-400">{{ timeAgo(item.data.createdAt) }}</span>
                </div>
                <p class="text-xs leading-relaxed text-surface-700 dark:text-surface-300 whitespace-pre-wrap">{{ item.data.body }}</p>
              </div>
            </div>

            <!-- Task -->
            <div v-else-if="item.kind === 'task'" class="flex items-start gap-2.5">
              <button
                class="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer"
                :class="item.data.completedAt
                  ? 'bg-success-100 dark:bg-success-950/40'
                  : 'bg-surface-100 dark:bg-surface-800 hover:bg-brand-50 dark:hover:bg-brand-950/30'"
                @click="emit('toggle-task', item.data.id, !item.data.completedAt)"
              >
                <SquareCheckBig v-if="item.data.completedAt" class="size-3 text-success-600 dark:text-success-400" />
                <Square v-else class="size-3 text-surface-400" />
              </button>
              <div class="flex-1 min-w-0 pt-0.5">
                <span class="text-xs" :class="item.data.completedAt ? 'line-through text-surface-400' : 'text-surface-700 dark:text-surface-300'">
                  {{ item.data.title }}
                </span>
                <span class="ml-1.5 text-[10px] text-surface-400">{{ timeAgo(item.data.createdAt) }}</span>
              </div>
            </div>

            <!-- Document -->
            <div v-else-if="item.kind === 'document'" class="flex items-center gap-2.5">
              <div class="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
                <FileText class="size-3 text-surface-400" />
              </div>
              <div class="flex-1 min-w-0">
                <span class="text-xs text-surface-700 dark:text-surface-300 truncate block">{{ item.data.originalFilename }}</span>
                <span class="text-[10px] text-surface-400">{{ formatDocumentType(item.data.type) }} · {{ timeAgo(item.data.createdAt) }}</span>
              </div>
              <a
                :href="`/api/documents/${item.data.id}/download`"
                class="text-[10px] text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium"
              >
                Download
              </a>
            </div>

            <!-- Interview -->
            <div v-else-if="item.kind === 'interview'" class="flex items-center gap-2.5">
              <div class="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950/40">
                <Calendar class="size-3 text-brand-600 dark:text-brand-400" />
              </div>
              <div class="flex-1 min-w-0">
                <span class="text-xs font-medium text-surface-700 dark:text-surface-300">{{ item.data.title }}</span>
                <span class="text-[10px] text-surface-400 block">{{ formatInterviewDateTime(item.data.scheduledAt) }}</span>
              </div>
            </div>

            <!-- History -->
            <div v-else-if="item.kind === 'history'" class="flex items-center gap-2.5">
              <div class="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
                <ArrowUpDown class="size-3 text-surface-400" />
              </div>
              <span class="text-[11px] text-surface-500 dark:text-surface-400">{{ formatActivityAction(item.data.action, item.data.metadata) }}</span>
              <span class="text-[10px] text-surface-400">{{ timeAgo(String(item.data.createdAt)) }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- Comment input (pinned bottom) -->
      <div class="shrink-0 border-t border-surface-200/80 dark:border-surface-800/60 p-3">
        <!-- Mode toggle pills -->
        <div class="mb-2 flex gap-1">
          <button
            class="cursor-pointer rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors"
            :class="inputMode === 'comment'
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:text-surface-500 dark:hover:text-surface-300 dark:hover:bg-surface-800'"
            @click="inputMode = 'comment'"
          >
            Comment
          </button>
          <button
            class="cursor-pointer rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors"
            :class="inputMode === 'task'
              ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'
              : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:text-surface-500 dark:hover:text-surface-300 dark:hover:bg-surface-800'"
            @click="inputMode = 'task'"
          >
            Task
          </button>
        </div>
        <div class="flex items-start gap-2">
          <textarea
            v-model="commentBody"
            rows="1"
            :placeholder="inputMode === 'task' ? 'Add a task...' : 'Write a comment...'"
            class="flex-1 resize-none rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400/30 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:placeholder:text-surface-500 dark:focus:border-brand-500 dark:focus:ring-brand-500/20"
            @keydown.enter.exact.prevent="handleSubmit"
          />
          <button
            :disabled="!commentBody.trim() || isSubmitting"
            class="self-stretch flex cursor-pointer items-center justify-center rounded-lg bg-brand-600 px-3 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            @click="handleSubmit"
          >
            {{ inputMode === 'task' ? 'Add' : 'Send' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
