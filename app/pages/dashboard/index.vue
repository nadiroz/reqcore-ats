<script setup lang="ts">
import {
  Briefcase, Users, FileText, Calendar, Plus,
  ArrowRight, Clock, AlertCircle, CheckCircle,
  MessageSquare, ClipboardCheck, ChevronRight,
  ExternalLink, LayoutDashboard,
} from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

useSeoMeta({
  title: 'Dashboard',
  description: 'Your recruiting command center',
})

const { activeOrg } = useCurrentOrg()
const localePath = useLocalePath()
const { track } = useTrack()
const { data: session } = await authClient.useSession(useFetch)

onMounted(() => track('dashboard_viewed'))

// ─────────────────────────────────────────────
// Greeting
// ─────────────────────────────────────────────

const firstName = computed(() => {
  const name = session.value?.user?.name ?? ''
  return name.split(' ')[0] || 'there'
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})

// ─────────────────────────────────────────────
// Dashboard stats
// ─────────────────────────────────────────────

const {
  counts,
  recentApplications,
  fetchStatus,
  error,
  refresh,
} = useDashboard()

// ─────────────────────────────────────────────
// Upcoming interviews (next 7 days)
// ─────────────────────────────────────────────

const now = new Date()
const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

const { interviews: upcomingInterviews } = useInterviews({
  status: 'scheduled',
  from: now.toISOString(),
  to: weekFromNow.toISOString(),
  limit: 5,
})

// ─────────────────────────────────────────────
// Approval requests
// ─────────────────────────────────────────────

const { data: approvalData } = useFetch<{ data: any[], total: number }>('/api/approval-requests', {
  key: 'dashboard-approvals',
  query: { status: 'pending' },
  headers: useRequestHeaders(['cookie']),
  default: () => ({ data: [], total: 0 }),
})

const pendingApprovals = computed(() => approvalData.value?.data ?? [])
const pendingApprovalCount = computed(() => approvalData.value?.total ?? 0)

// ─────────────────────────────────────────────
// Summary card counts
// ─────────────────────────────────────────────

const todayApplicationCount = computed(() => {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return recentApplications.value.filter(
    (a: any) => new Date(a.createdAt) >= todayStart,
  ).length
})

const upcomingInterviewCount = computed(() => upcomingInterviews.value.length)

// ─────────────────────────────────────────────
// Needs Your Attention items
// ─────────────────────────────────────────────

interface AttentionItem {
  id: string
  icon: any
  iconColor: string
  iconBg: string
  title: string
  description: string
  timeAgo: string
  to: string
}

const attentionItems = computed<AttentionItem[]>(() => {
  const items: AttentionItem[] = []

  // Pending approvals
  for (const req of pendingApprovals.value.slice(0, 3)) {
    items.push({
      id: `approval-${req.id}`,
      icon: CheckCircle,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
      title: `Approval needed: ${req.candidateFirstName} ${req.candidateLastName}`,
      description: `Move from ${formatStage(req.fromStage)} to ${formatStage(req.toStage)} for ${req.jobTitle}`,
      timeAgo: formatDate(req.createdAt),
      to: localePath(`/dashboard/applications/${req.applicationId}`),
    })
  }

  // New applications to review
  const unreviewed = recentApplications.value.filter((a: any) => a.status === 'new')
  for (const app of unreviewed.slice(0, 3)) {
    items.push({
      id: `app-${app.id}`,
      icon: FileText,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-50 dark:bg-blue-950/40',
      title: `New application: ${app.candidateFirstName} ${app.candidateLastName}`,
      description: `Applied for ${app.jobTitle}`,
      timeAgo: formatDate(app.createdAt),
      to: localePath(`/dashboard/applications/${app.id}`),
    })
  }

  return items.slice(0, 6)
})

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatStage(stage: string): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1).replace(/_/g, ' ')
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr)
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffDays === 0) {
    if (diffHours <= 0) return 'Now'
    return `In ${diffHours}h`
  }
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `In ${diffDays} days`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatInterviewDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const interviewTypeLabels: Record<string, string> = {
  phone: 'Phone',
  video: 'Video',
  in_person: 'In-person',
  panel: 'Panel',
  technical: 'Technical',
  take_home: 'Take-home',
}

const isEmpty = computed(() =>
  counts.value.openJobs === 0
  && counts.value.totalCandidates === 0
  && counts.value.totalApplications === 0,
)
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <!-- Loading skeleton -->
    <div v-if="fetchStatus === 'pending'">
      <div class="mb-8">
        <div class="h-8 w-72 bg-surface-200 dark:bg-surface-700 rounded-lg animate-pulse mb-2" />
        <div class="h-4 w-48 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div v-for="i in 3" :key="i" class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5 animate-pulse">
          <div class="h-4 w-24 bg-surface-200 dark:bg-surface-700 rounded mb-3" />
          <div class="h-8 w-12 bg-surface-200 dark:bg-surface-700 rounded" />
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div class="lg:col-span-3 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-6 animate-pulse">
          <div class="h-5 w-40 bg-surface-200 dark:bg-surface-700 rounded mb-5" />
          <div class="space-y-4">
            <div v-for="i in 3" :key="i" class="h-16 bg-surface-100 dark:bg-surface-800 rounded-lg" />
          </div>
        </div>
        <div class="lg:col-span-2 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-6 animate-pulse">
          <div class="h-5 w-40 bg-surface-200 dark:bg-surface-700 rounded mb-5" />
          <div class="space-y-3">
            <div v-for="i in 3" :key="i" class="h-14 bg-surface-100 dark:bg-surface-800 rounded-lg" />
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-xl border border-danger-200 dark:border-danger-900 bg-danger-50 dark:bg-danger-950/60 p-5 text-sm text-danger-700 dark:text-danger-400 flex items-center gap-3"
    >
      <AlertCircle class="size-5 shrink-0" />
      <span>Failed to load dashboard.</span>
      <button class="underline ml-auto font-medium cursor-pointer" @click="refresh()">Retry</button>
    </div>

    <!-- Empty state (brand new org) -->
    <div v-else-if="isEmpty" class="flex flex-col items-center justify-center py-24">
      <div class="rounded-xl border border-surface-200/80 bg-white dark:border-surface-800/60 dark:bg-surface-900 p-14 text-center max-w-md shadow-sm">
        <div class="mx-auto mb-8 flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/20">
          <LayoutDashboard class="size-8 text-white" />
        </div>
        <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-3 tracking-tight">
          Welcome to Reqcore
        </h2>
        <p class="text-sm text-surface-500 dark:text-surface-400 mb-10 leading-relaxed max-w-sm mx-auto">
          Your recruiting command center. Create your first job posting to start building your hiring pipeline.
        </p>
        <NuxtLink
          :to="localePath('/dashboard/jobs/new')"
          class="inline-flex items-center gap-2.5 rounded-xl bg-brand-600 px-7 py-3.5 text-sm font-semibold text-white hover:bg-brand-700 shadow-md shadow-brand-600/20 hover:shadow-lg hover:shadow-brand-600/25 transition-all no-underline"
        >
          <Plus class="size-4" />
          Create Your First Job
        </NuxtLink>
      </div>
    </div>

    <!-- Dashboard content -->
    <template v-else>
      <!-- Greeting -->
      <div class="flex items-start justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50 tracking-tight">
            {{ greeting }}, {{ firstName }}
          </h1>
          <p v-if="activeOrg" class="text-sm text-surface-400 dark:text-surface-500 mt-1">
            Here's what needs your attention at {{ activeOrg.name }}.
          </p>
        </div>
        <NuxtLink
          :to="localePath('/dashboard/jobs/new')"
          class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 shadow-sm shadow-brand-600/15 hover:shadow-md hover:shadow-brand-600/20 transition-all no-underline shrink-0"
        >
          <Plus class="size-4" />
          New Job
        </NuxtLink>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <!-- Pending Approvals -->
        <NuxtLink
          :to="localePath('/dashboard/applications')"
          class="group rounded-xl border bg-white dark:bg-surface-900 p-5 transition-all duration-150 no-underline"
          :class="pendingApprovalCount > 0
            ? 'border-amber-200 dark:border-amber-900/50 hover:border-amber-300 dark:hover:border-amber-800/60 hover:shadow-md hover:shadow-amber-500/5'
            : 'border-surface-200/80 dark:border-surface-800/60 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-md hover:shadow-surface-500/5'"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">Pending Approvals</span>
            <div
              class="flex items-center justify-center size-8 rounded-lg transition-colors"
              :class="pendingApprovalCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/40'
                : 'bg-surface-100 dark:bg-surface-800'"
            >
              <CheckCircle class="size-4" :class="pendingApprovalCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-surface-400'" />
            </div>
          </div>
          <div
            class="text-3xl font-bold tracking-tight tabular-nums"
            :class="pendingApprovalCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-surface-900 dark:text-surface-50'"
          >
            {{ pendingApprovalCount }}
          </div>
          <p class="text-xs mt-1" :class="pendingApprovalCount > 0 ? 'text-amber-600/80 dark:text-amber-400/80 font-medium' : 'text-surface-400'">
            {{ pendingApprovalCount > 0 ? 'Awaiting your decision' : 'All clear' }}
          </p>
        </NuxtLink>

        <!-- New Applications (today) -->
        <NuxtLink
          :to="localePath({ path: '/dashboard/applications', query: { status: 'new' } })"
          class="group rounded-xl border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900 p-5 hover:border-blue-300 dark:hover:border-blue-800/60 hover:shadow-md hover:shadow-blue-500/5 transition-all duration-150 no-underline"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">New Applications</span>
            <div class="flex items-center justify-center size-8 rounded-lg bg-blue-50 dark:bg-blue-950/40">
              <FileText class="size-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div class="text-3xl font-bold text-surface-900 dark:text-surface-50 tracking-tight tabular-nums">
            {{ todayApplicationCount }}
          </div>
          <p class="text-xs text-surface-400 mt-1">Received today</p>
        </NuxtLink>

        <!-- Upcoming Interviews -->
        <NuxtLink
          :to="localePath('/dashboard/interviews')"
          class="group rounded-xl border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900 p-5 hover:border-violet-300 dark:hover:border-violet-800/60 hover:shadow-md hover:shadow-violet-500/5 transition-all duration-150 no-underline"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">Upcoming Interviews</span>
            <div class="flex items-center justify-center size-8 rounded-lg bg-violet-50 dark:bg-violet-950/40">
              <Calendar class="size-4 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <div class="text-3xl font-bold text-surface-900 dark:text-surface-50 tracking-tight tabular-nums">
            {{ upcomingInterviewCount }}
          </div>
          <p class="text-xs text-surface-400 mt-1">Next 7 days</p>
        </NuxtLink>
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <!-- Needs Your Attention (left, wider) -->
        <div class="lg:col-span-3">
          <div class="rounded-xl border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900 overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-surface-100 dark:border-surface-800">
              <div class="flex items-center gap-2.5">
                <div class="flex items-center justify-center size-7 rounded-lg bg-amber-50 dark:bg-amber-950/40">
                  <AlertCircle class="size-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 class="text-sm font-semibold text-surface-900 dark:text-surface-100">Needs Your Attention</h2>
              </div>
              <span v-if="attentionItems.length > 0" class="text-xs font-medium text-surface-400 tabular-nums">
                {{ attentionItems.length }} item{{ attentionItems.length === 1 ? '' : 's' }}
              </span>
            </div>

            <!-- Empty state -->
            <div v-if="attentionItems.length === 0" class="px-5 py-12 text-center">
              <div class="mx-auto mb-4 flex items-center justify-center size-12 rounded-xl bg-green-50 dark:bg-green-950/30">
                <CheckCircle class="size-5 text-green-500 dark:text-green-400" />
              </div>
              <p class="text-sm font-medium text-surface-500 dark:text-surface-400 mb-0.5">You're all caught up</p>
              <p class="text-xs text-surface-400 dark:text-surface-500">Nothing needs your attention right now.</p>
            </div>

            <!-- Items -->
            <div v-else class="divide-y divide-surface-100 dark:divide-surface-800">
              <NuxtLink
                v-for="item in attentionItems"
                :key="item.id"
                :to="item.to"
                class="flex items-center gap-4 px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors no-underline group"
              >
                <div
                  class="flex items-center justify-center size-9 rounded-lg shrink-0"
                  :class="item.iconBg"
                >
                  <component :is="item.icon" class="size-4" :class="item.iconColor" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-surface-900 dark:text-surface-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {{ item.title }}
                  </p>
                  <p class="text-xs text-surface-400 dark:text-surface-500 truncate mt-0.5">
                    {{ item.description }}
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[11px] text-surface-400 dark:text-surface-500 tabular-nums">{{ item.timeAgo }}</span>
                  <ChevronRight class="size-4 text-surface-300 dark:text-surface-600 group-hover:text-brand-500 transition-colors" />
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Upcoming Interviews (right, narrower) -->
        <div class="lg:col-span-2">
          <div class="rounded-xl border border-surface-200/80 dark:border-surface-800/60 bg-white dark:bg-surface-900 overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-surface-100 dark:border-surface-800">
              <div class="flex items-center gap-2.5">
                <div class="flex items-center justify-center size-7 rounded-lg bg-violet-50 dark:bg-violet-950/40">
                  <Calendar class="size-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <h2 class="text-sm font-semibold text-surface-900 dark:text-surface-100">Upcoming Interviews</h2>
              </div>
              <NuxtLink
                :to="localePath('/dashboard/interviews')"
                class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 no-underline inline-flex items-center gap-1 group/link"
              >
                All
                <ArrowRight class="size-3 group-hover/link:translate-x-0.5 transition-transform" />
              </NuxtLink>
            </div>

            <!-- Empty state -->
            <div v-if="upcomingInterviews.length === 0" class="px-5 py-12 text-center">
              <div class="mx-auto mb-4 flex items-center justify-center size-12 rounded-xl bg-surface-100 dark:bg-surface-800">
                <Calendar class="size-5 text-surface-400 dark:text-surface-500" />
              </div>
              <p class="text-sm font-medium text-surface-500 dark:text-surface-400 mb-0.5">No upcoming interviews</p>
              <p class="text-xs text-surface-400 dark:text-surface-500">Next 7 days are clear</p>
            </div>

            <!-- Interview list -->
            <div v-else class="divide-y divide-surface-100 dark:divide-surface-800">
              <NuxtLink
                v-for="interview in upcomingInterviews"
                :key="interview.id"
                :to="localePath(`/dashboard/interviews/${interview.id}`)"
                class="block px-5 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors no-underline group"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm font-medium text-surface-900 dark:text-surface-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {{ interview.candidateFirstName }} {{ interview.candidateLastName }}
                  </span>
                  <span class="inline-flex items-center rounded-full bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-400 shrink-0 ml-2">
                    {{ formatRelativeDate(interview.scheduledAt) }}
                  </span>
                </div>
                <p class="text-xs text-surface-500 dark:text-surface-400 truncate mb-1.5">
                  {{ interview.jobTitle }}
                </p>
                <div class="flex items-center gap-2 text-xs text-surface-400 dark:text-surface-500">
                  <span class="font-medium">{{ formatInterviewDate(interview.scheduledAt) }}</span>
                  <span class="text-surface-200 dark:text-surface-700">&middot;</span>
                  <span>{{ formatTime(interview.scheduledAt) }}</span>
                  <span class="text-surface-200 dark:text-surface-700">&middot;</span>
                  <span>{{ interviewTypeLabels[interview.type] ?? interview.type }}</span>
                  <a
                    v-if="interview.googleCalendarEventLink"
                    :href="interview.googleCalendarEventLink"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors shrink-0 ml-auto"
                    @click.stop
                  >
                    <ExternalLink class="size-2.5" />
                    Cal
                  </a>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
