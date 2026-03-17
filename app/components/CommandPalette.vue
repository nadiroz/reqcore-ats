<script setup lang="ts">
import {
  Search, X, Briefcase, Users, FileText,
  Settings, ArrowUpCircle, LayoutDashboard, Calendar,
} from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
}>()

const localePath = useLocalePath()
const router = useRouter()

const query = ref('')
const selectedIndex = ref(0)
const inputRef = useTemplateRef<HTMLInputElement>('searchInput')

// Quick actions (always visible when query is empty)
const quickActions = [
  { id: 'jobs', label: 'Go to Jobs', icon: Briefcase, to: '/dashboard/jobs' },
  { id: 'candidates', label: 'Go to Candidates', icon: Users, to: '/dashboard/candidates' },
  { id: 'applications', label: 'Go to Applications', icon: FileText, to: '/dashboard/applications' },
  { id: 'interviews', label: 'Go to Interviews', icon: Calendar, to: '/dashboard/interviews' },
  { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { id: 'settings', label: 'Go to Settings', icon: Settings, to: '/dashboard/settings' },
  { id: 'updates', label: 'Go to Updates', icon: ArrowUpCircle, to: '/dashboard/updates' },
]

// Search results
const { data: candidateResults, status: candidateStatus } = useFetch<{ data: any[] }>('/api/candidates', {
  query: computed(() => ({ search: query.value, limit: 5 })),
  headers: useRequestHeaders(['cookie']),
  immediate: false,
  watch: false,
})

const { data: jobResults, status: jobStatus } = useFetch<{ data: any[] }>('/api/jobs', {
  query: computed(() => ({ limit: 10 })),
  headers: useRequestHeaders(['cookie']),
})

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(query, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (val.length >= 2) {
    searchTimeout = setTimeout(() => {
      refreshNuxtData('command-palette-candidates')
    }, 200)
  }
})

// Filtered quick actions
const filteredActions = computed(() => {
  if (!query.value) return quickActions
  const q = query.value.toLowerCase()
  return quickActions.filter(a => a.label.toLowerCase().includes(q))
})

// Filtered jobs (client-side filter from pre-fetched list)
const filteredJobs = computed(() => {
  const jobs = jobResults.value?.data ?? []
  if (!query.value) return jobs.slice(0, 5)
  const q = query.value.toLowerCase()
  return jobs.filter((j: any) => j.title?.toLowerCase().includes(q)).slice(0, 5)
})

// Candidates from API search
const searchedCandidates = computed(() => {
  if (query.value.length < 2) return []
  return candidateResults.value?.data ?? []
})

// Combined results list for keyboard navigation
const allItems = computed(() => {
  const items: Array<{ type: string; id: string; label: string; sublabel?: string; to: string; icon?: any }> = []

  for (const action of filteredActions.value) {
    items.push({ type: 'action', id: action.id, label: action.label, to: action.to, icon: action.icon })
  }
  for (const job of filteredJobs.value) {
    items.push({
      type: 'job',
      id: job.id,
      label: job.title,
      sublabel: job.status,
      to: `/dashboard/jobs/${job.id}`,
      icon: Briefcase,
    })
  }
  for (const c of searchedCandidates.value) {
    items.push({
      type: 'candidate',
      id: c.id,
      label: `${c.firstName} ${c.lastName}`,
      sublabel: c.email,
      to: `/dashboard/candidates/${c.id}`,
      icon: Users,
    })
  }

  return items
})

// Reset selection when results change
watch(allItems, () => {
  selectedIndex.value = 0
})

function navigate(to: string) {
  emit('close')
  query.value = ''
  router.push(localePath(to))
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, allItems.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = allItems.value[selectedIndex.value]
    if (item) navigate(item.to)
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

// Focus input when opened
watch(() => props.open, (val) => {
  if (val) {
    query.value = ''
    selectedIndex.value = 0
    nextTick(() => inputRef.value?.focus())
  }
})

function onBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement)?.dataset?.backdrop) {
    emit('close')
  }
}

const isSearching = computed(() =>
  candidateStatus.value === 'pending' || jobStatus.value === 'pending',
)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        data-backdrop="true"
        class="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-surface-900/50 dark:bg-surface-950/70 backdrop-blur-sm"
        @click="onBackdropClick"
      >
        <div
          class="w-full max-w-lg rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-2xl shadow-surface-900/20 dark:shadow-surface-950/50 overflow-hidden"
          @keydown="onKeyDown"
        >
          <!-- Search input -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-100 dark:border-surface-800">
            <Search class="size-4 text-surface-400 shrink-0" />
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              placeholder="Search candidates, jobs, or type a command..."
              class="flex-1 bg-transparent border-0 outline-none text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400"
            />
            <kbd class="hidden sm:inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-surface-400 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
              ESC
            </kbd>
          </div>

          <!-- Results -->
          <div class="max-h-80 overflow-y-auto py-2">
            <!-- Quick actions -->
            <div v-if="filteredActions.length > 0">
              <p class="px-4 py-1 text-[10px] font-medium text-surface-400 uppercase tracking-wider">
                {{ query ? 'Actions' : 'Quick Actions' }}
              </p>
              <button
                v-for="(action, i) in filteredActions"
                :key="action.id"
                class="flex items-center gap-3 w-full px-4 py-2 text-sm text-left transition-colors cursor-pointer border-0 bg-transparent"
                :class="selectedIndex === i
                  ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                  : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'"
                @click="navigate(action.to)"
                @mouseenter="selectedIndex = i"
              >
                <component :is="action.icon" class="size-4 shrink-0 opacity-60" />
                {{ action.label }}
              </button>
            </div>

            <!-- Jobs -->
            <div v-if="filteredJobs.length > 0">
              <p class="px-4 py-1 mt-1 text-[10px] font-medium text-surface-400 uppercase tracking-wider">Jobs</p>
              <button
                v-for="(job, i) in filteredJobs"
                :key="job.id"
                class="flex items-center gap-3 w-full px-4 py-2 text-sm text-left transition-colors cursor-pointer border-0 bg-transparent"
                :class="selectedIndex === filteredActions.length + i
                  ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                  : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'"
                @click="navigate(`/dashboard/jobs/${job.id}`)"
                @mouseenter="selectedIndex = filteredActions.length + i"
              >
                <Briefcase class="size-4 shrink-0 opacity-60" />
                <span class="truncate">{{ job.title }}</span>
                <span
                  v-if="job.status"
                  class="ml-auto text-[10px] font-medium capitalize text-surface-400"
                >
                  {{ job.status }}
                </span>
              </button>
            </div>

            <!-- Candidates (search results) -->
            <div v-if="searchedCandidates.length > 0">
              <p class="px-4 py-1 mt-1 text-[10px] font-medium text-surface-400 uppercase tracking-wider">Candidates</p>
              <button
                v-for="(c, i) in searchedCandidates"
                :key="c.id"
                class="flex items-center gap-3 w-full px-4 py-2 text-sm text-left transition-colors cursor-pointer border-0 bg-transparent"
                :class="selectedIndex === filteredActions.length + filteredJobs.length + i
                  ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                  : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'"
                @click="navigate(`/dashboard/candidates/${c.id}`)"
                @mouseenter="selectedIndex = filteredActions.length + filteredJobs.length + i"
              >
                <Users class="size-4 shrink-0 opacity-60" />
                <div class="min-w-0">
                  <span class="truncate block">{{ c.firstName }} {{ c.lastName }}</span>
                  <span class="text-xs text-surface-400 truncate block">{{ c.email }}</span>
                </div>
              </button>
            </div>

            <!-- Empty state -->
            <div
              v-if="query.length >= 2 && !isSearching && filteredActions.length === 0 && filteredJobs.length === 0 && searchedCandidates.length === 0"
              class="px-4 py-8 text-center"
            >
              <p class="text-sm text-surface-400">No results for "{{ query }}"</p>
            </div>

            <!-- Searching indicator -->
            <div v-if="isSearching && query.length >= 2" class="px-4 py-3 text-center">
              <p class="text-xs text-surface-400">Searching...</p>
            </div>
          </div>

          <!-- Footer hint -->
          <div class="px-4 py-2 border-t border-surface-100 dark:border-surface-800 flex items-center gap-4 text-[10px] text-surface-400">
            <span class="flex items-center gap-1">
              <kbd class="inline-flex items-center rounded px-1 py-0.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 font-medium">↑↓</kbd>
              navigate
            </span>
            <span class="flex items-center gap-1">
              <kbd class="inline-flex items-center rounded px-1 py-0.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 font-medium">↵</kbd>
              select
            </span>
            <span class="flex items-center gap-1">
              <kbd class="inline-flex items-center rounded px-1 py-0.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 font-medium">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
