<script setup lang="ts">
import {
  Briefcase, Bell,
  Kanban, FileText, LogOut, Table2,
  Sun, Moon, MessageSquarePlus, Settings,
  ChevronDown, Menu, X, Users, PanelLeftClose, PanelLeftOpen,
  LayoutDashboard, Calendar, ArrowUpCircle,
  Cloud, Server, Sparkles, Search, User,
  ClipboardCheck, MessageCircle, CheckSquare,
  ArrowRight, ClipboardList, ShieldCheck, Cog, MapPin,
} from 'lucide-vue-next'
import { timeAgo, formatJobType } from '~/utils/pipeline-helpers'

const route = useRoute()
const localePath = useLocalePath()
const getRouteBaseName = useRouteBaseName()
const { data: session } = await authClient.useSession(useFetch)
const isSigningOut = ref(false)
const { isDark, toggle: toggleColorMode } = useColorMode()

const showFeedbackModal = ref(false)
const showUserMenu = ref(false)
const showMobileMenu = ref(false)
const showGetStartedMenu = ref(false)

const config = useRuntimeConfig()
const { activeOrg, orgs } = useCurrentOrg()

const isDemo = computed(() => {
  const slug = config.public.demoOrgSlug
  return slug && activeOrg.value?.slug === slug
})

const getStartedMenuRef = useTemplateRef<HTMLElement>('getStartedMenuRoot')
function onClickOutsideGetStarted(e: MouseEvent) {
  if (getStartedMenuRef.value && !getStartedMenuRef.value.contains(e.target as Node)) {
    showGetStartedMenu.value = false
  }
}

const userName = computed(() => session.value?.user?.name ?? 'User')
const userEmail = computed(() => session.value?.user?.email ?? '')
const userInitials = computed(() => {
  const name = userName.value
  const parts = name.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0] ?? ''
    const second = parts[1] ?? ''
    return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
})

async function handleSignOut() {
  isSigningOut.value = true
  await authClient.signOut()
  clearNuxtData()
  await navigateTo(localePath('/auth/sign-in'))
}

// ─────────────────────────────────────────────
// Dynamic job context
// ─────────────────────────────────────────────

const activeJobId = computed(() => {
  const baseName = getRouteBaseName(route)
  if (typeof baseName !== 'string' || !baseName.startsWith('dashboard-jobs-id')) return null
  const idParam = route.params.id
  if (typeof idParam !== 'string' || idParam === 'new') return null
  return idParam
})

const {
  data: sidebarJobsData,
} = useFetch('/api/jobs', {
  key: 'sidebar-jobs-list',
  query: { limit: 100 },
  headers: useRequestHeaders(['cookie']),
})

const sidebarJobs = computed(() => sidebarJobsData.value?.data ?? [])

const activeJobTitle = computed(() => {
  if (!activeJobId.value) return null
  const found = sidebarJobs.value.find((j: any) => j.id === activeJobId.value)
  return found?.title ?? 'Job'
})

const activeJobStatus = computed(() => {
  if (!activeJobId.value) return null
  const found = sidebarJobs.value.find((j: any) => j.id === activeJobId.value)
  return (found as any)?.status ?? null
})

const jobStatusBadgeClasses: Record<string, string> = {
  draft: 'bg-surface-50 text-surface-600 ring-surface-200 dark:bg-surface-800/60 dark:text-surface-400 dark:ring-surface-700',
  open: 'bg-success-50 text-success-700 ring-success-200 dark:bg-success-950/60 dark:text-success-400 dark:ring-success-800',
  closed: 'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-950/60 dark:text-warning-400 dark:ring-warning-800',
  archived: 'bg-surface-50 text-surface-400 ring-surface-200 dark:bg-surface-800/60 dark:text-surface-500 dark:ring-surface-700',
}

const { data: feedbackConfig } = useFetch('/api/feedback/config', {
  key: 'feedback-config',
  headers: useRequestHeaders(['cookie']),
})

const isFeedbackEnabled = computed(() => feedbackConfig.value?.enabled === true)

// ─────────────────────────────────────────────
// Notifications (bell)
// ─────────────────────────────────────────────

const {
  notifications,
  unreadCount,
  fetchNotifications,
  markRead,
  markAllRead,
} = useNotifications()

const showNotificationDropdown = ref(false)
const notificationDropdownRef = useTemplateRef<HTMLElement>('notificationDropdownRoot')

function onClickOutsideNotifications(e: MouseEvent) {
  if (notificationDropdownRef.value && !notificationDropdownRef.value.contains(e.target as Node)) {
    showNotificationDropdown.value = false
  }
}

// Fetch full list when dropdown opens
watch(showNotificationDropdown, (val: boolean) => {
  if (val) fetchNotifications()
})

// Notification type -> icon + color mapping
const notificationTypeConfig: Record<string, { icon: any; colorClass: string }> = {
  application_status_changed: { icon: ArrowRight, colorClass: 'text-brand-500 bg-brand-50 dark:bg-brand-950/40' },
  comment_added: { icon: MessageCircle, colorClass: 'text-info-500 bg-info-50 dark:bg-info-950/40' },
  approval_requested: { icon: ShieldCheck, colorClass: 'text-warning-500 bg-warning-50 dark:bg-warning-950/40' },
  approval_resolved: { icon: ShieldCheck, colorClass: 'text-success-500 bg-success-50 dark:bg-success-950/40' },
  assessment_decision: { icon: ClipboardList, colorClass: 'text-violet-500 bg-violet-50 dark:bg-violet-950/40' },
  assessment_advanced: { icon: ClipboardList, colorClass: 'text-brand-500 bg-brand-50 dark:bg-brand-950/40' },
  interview_scheduled: { icon: Calendar, colorClass: 'text-info-500 bg-info-50 dark:bg-info-950/40' },
  task_created: { icon: CheckSquare, colorClass: 'text-warning-500 bg-warning-50 dark:bg-warning-950/40' },
}

function getNotificationConfig(type: string) {
  return notificationTypeConfig[type] ?? { icon: Bell, colorClass: 'text-surface-400 bg-surface-100 dark:bg-surface-800' }
}

function handleNotificationClick(n: any) {
  markRead(n.id)
  showNotificationDropdown.value = false
  if (n.resourceType === 'application' && n.resourceId) {
    navigateTo(localePath(`/dashboard/applications/${n.resourceId}`))
  }
}

onMounted(() => document.addEventListener('click', onClickOutsideNotifications))
onUnmounted(() => document.removeEventListener('click', onClickOutsideNotifications))

const jobPipelineTabs = computed(() => {
  if (!activeJobId.value) return []
  const base = `/dashboard/jobs/${activeJobId.value}`
  return [
    { label: 'Board', to: base, icon: Kanban, exact: true },
    { label: 'Table', to: `${base}/candidates`, icon: Table2, exact: true },
  ]
})

const jobConfigTabs = computed(() => {
  if (!activeJobId.value) return []
  const base = `/dashboard/jobs/${activeJobId.value}`
  return [
    { label: 'Assessment', to: `${base}/assessment`, icon: ClipboardCheck, exact: true },
    { label: 'Application Form', to: `${base}/application-form`, icon: FileText, exact: true },
  ]
})

const showConfigMenu = ref(false)
const configMenuRef = useTemplateRef<HTMLElement>('configMenuRoot')

function onClickOutsideConfigMenu(e: MouseEvent) {
  if (configMenuRef.value && !configMenuRef.value.contains(e.target as Node)) {
    showConfigMenu.value = false
  }
}

const isConfigRouteActive = computed(() =>
  jobConfigTabs.value.some(tab => isActiveRoute(tab.to, tab.exact)),
)

// Persistent job sidebar (shared via useState, open by default)
const showJobSidebar = useState('jobSidebar', () => true)

// ─────────────────────────────────────────────
// Main navigation
// ─────────────────────────────────────────────

const mainNav = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Jobs', to: '/dashboard/jobs', icon: Briefcase, exact: false },
  { label: 'Candidates', to: '/dashboard/candidates', icon: Users, exact: false },
  { label: 'Applications', to: '/dashboard/applications', icon: FileText, exact: false },
  { label: 'Interviews', to: '/dashboard/interviews', icon: Calendar, exact: false },
]

const emit = defineEmits<{
  (e: 'open-command-palette'): void
}>()

function isActiveRoute(to: string, exact: boolean) {
  const localizedTo = localePath(to)
  if (exact) return route.path === localizedTo
  return route.path === localizedTo || route.path.startsWith(`${localizedTo}/`)
}

// Close menus on route change
watch(() => route.path, () => {
  showUserMenu.value = false
  showMobileMenu.value = false
  showGetStartedMenu.value = false
  showNotificationDropdown.value = false
  showConfigMenu.value = false
})

// Close user menu on outside click
const userMenuRef = useTemplateRef<HTMLElement>('userMenuRoot')
function onClickOutsideUser(e: MouseEvent) {
  if (userMenuRef.value && !userMenuRef.value.contains(e.target as Node)) {
    showUserMenu.value = false
  }
}
onMounted(() => {
  document.addEventListener('click', onClickOutsideUser)
  document.addEventListener('click', onClickOutsideGetStarted)
  document.addEventListener('click', onClickOutsideConfigMenu)
})
onUnmounted(() => {
  document.removeEventListener('click', onClickOutsideUser)
  document.removeEventListener('click', onClickOutsideGetStarted)
  document.removeEventListener('click', onClickOutsideConfigMenu)
})
</script>

<template>
  <header class="sticky top-0 z-50 w-full">
    <!-- Primary navigation bar -->
    <div class="relative z-20 border-b border-surface-200/80 dark:border-surface-800/80 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl">
      <div class="flex h-14 items-center justify-between px-4 lg:px-6">
        <!-- Left: Logo + Nav -->
        <div class="flex items-center gap-1 lg:gap-2">
          <!-- Logo -->
          <a
            :href="useRuntimeConfig().public.marketingUrl"
            class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg no-underline hover:bg-surface-100/60 dark:hover:bg-surface-800/60 transition-colors mr-1 lg:mr-4"
          >
            <img src="/eagle-mascot-logo.png" alt="Reqcore mascot" class="size-7 shrink-0 object-contain" />
            <span class="text-[15px] font-bold text-surface-900 dark:text-surface-100 hidden sm:block tracking-tight">Reqcore</span>
          </a>

          <!-- Desktop nav links -->
          <nav class="hidden md:flex items-center gap-0.5">
            <NuxtLink
              v-for="item in mainNav"
              :key="item.to"
              :to="$localePath(item.to)"
              class="relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 no-underline"
              :class="isActiveRoute(item.to, item.exact)
                ? 'text-brand-700 dark:text-brand-300 bg-brand-50/80 dark:bg-brand-950/40'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100/80 dark:hover:bg-surface-800/60'"
            >
              <component :is="item.icon" class="size-4" />
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center gap-1 lg:gap-1.5">
          <!-- Get Started CTA (demo mode only) -->
          <div v-if="isDemo" ref="getStartedMenuRoot" class="relative hidden sm:block">
            <button
              class="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-1.5 text-[13px] font-semibold text-white shadow-md shadow-brand-600/25 hover:shadow-lg hover:shadow-brand-600/30 active:shadow-sm transition-all duration-200 cursor-pointer border-0"
              @click="showGetStartedMenu = !showGetStartedMenu"
            >
              <Sparkles class="size-3.5 transition-transform duration-300 group-hover:rotate-12" />
              Get Started
              <ChevronDown
                class="size-3 opacity-70 transition-transform duration-200"
                :class="showGetStartedMenu ? 'rotate-180' : ''"
              />
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
                v-if="showGetStartedMenu"
                class="absolute right-0 top-[calc(100%+6px)] w-72 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-xl shadow-surface-900/8 dark:shadow-surface-950/30 overflow-hidden"
              >
                <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
                  <p class="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Choose your setup</p>
                </div>
                <div class="p-2 space-y-1">
                  <NuxtLink
                    :to="$localePath('/auth/fresh-signup')"
                    class="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-brand-50 dark:hover:bg-brand-950/30 no-underline group/item"
                  >
                    <div class="flex items-center justify-center size-8 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5">
                      <Cloud class="size-4" />
                    </div>
                    <div>
                      <div class="text-sm font-semibold text-surface-900 dark:text-surface-100 group-hover/item:text-brand-700 dark:group-hover/item:text-brand-300 transition-colors">Cloud Hosted</div>
                      <div class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">Start free in seconds — we handle hosting, updates &amp; backups</div>
                    </div>
                  </NuxtLink>
                  <a
                    href="https://github.com/reqcore-inc/reqcore#quick-start"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/60 no-underline group/item"
                  >
                    <div class="flex items-center justify-center size-8 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 shrink-0 mt-0.5">
                      <Server class="size-4" />
                    </div>
                    <div>
                      <div class="text-sm font-semibold text-surface-900 dark:text-surface-100 group-hover/item:text-surface-700 dark:group-hover/item:text-surface-200 transition-colors">Self-Host</div>
                      <div class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">Deploy on your own infrastructure — full control, 100% free</div>
                    </div>
                  </a>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Org Switcher (only when multiple orgs exist) -->
          <div v-if="orgs && orgs.length > 1" class="hidden lg:block ml-1">
            <OrgSwitcher />
          </div>

          <!-- Command palette trigger (Cmd+K) -->
          <button
            class="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200 cursor-pointer border border-surface-200 dark:border-surface-700 bg-transparent"
            title="Search (⌘K)"
            @click="emit('open-command-palette')"
          >
            <Search class="size-3.5" />
            <span class="text-xs">⌘K</span>
          </button>

          <!-- Notification bell -->
          <div ref="notificationDropdownRoot" class="relative">
            <button
              class="relative flex items-center justify-center size-8 rounded-lg text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200 cursor-pointer border-0 bg-transparent"
              title="Notifications"
              @click="showNotificationDropdown = !showNotificationDropdown"
            >
              <Bell class="size-4" />
              <span
                v-if="unreadCount > 0"
                class="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-danger-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-surface-900"
              >
                {{ unreadCount > 9 ? '9+' : unreadCount }}
              </span>
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
                v-if="showNotificationDropdown"
                class="absolute right-0 top-[calc(100%+6px)] w-80 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-xl shadow-surface-900/8 dark:shadow-surface-950/30 overflow-hidden"
              >
                <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
                  <p class="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Notifications</p>
                  <button
                    v-if="unreadCount > 0"
                    class="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 cursor-pointer border-0 bg-transparent"
                    @click="markAllRead()"
                  >
                    Mark all read
                  </button>
                </div>
                <div v-if="notifications.length === 0" class="px-4 py-6 text-center">
                  <p class="text-sm text-surface-400">No notifications yet</p>
                </div>
                <div v-else class="max-h-80 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800">
                  <button
                    v-for="n in notifications"
                    :key="n.id"
                    class="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-800/60 transition-colors cursor-pointer border-0 bg-transparent"
                    @click="handleNotificationClick(n)"
                  >
                    <div
                      class="mt-0.5 flex items-center justify-center size-7 shrink-0 rounded-lg"
                      :class="getNotificationConfig(n.type).colorClass"
                    >
                      <component :is="getNotificationConfig(n.type).icon" class="size-3.5" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <p
                          class="text-sm truncate flex-1"
                          :class="n.readAt ? 'text-surface-500 dark:text-surface-400' : 'font-medium text-surface-800 dark:text-surface-200'"
                        >
                          {{ n.title }}
                        </p>
                        <span
                          v-if="!n.readAt"
                          class="size-1.5 shrink-0 rounded-full bg-brand-500"
                        />
                      </div>
                      <p v-if="n.body" class="text-xs text-surface-400 dark:text-surface-500 truncate mt-0.5">
                        {{ n.body }}
                      </p>
                      <p class="text-[11px] text-surface-400 dark:text-surface-500 mt-1">
                        {{ timeAgo(n.createdAt) }}
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Divider -->
          <div class="hidden sm:block w-px h-6 bg-surface-200 dark:bg-surface-700 mx-1" />

          <!-- User menu -->
          <div ref="userMenuRoot" class="relative">
            <button
              class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-100/80 dark:hover:bg-surface-800/60 transition-all duration-200 cursor-pointer border-0 bg-transparent"
              @click="showUserMenu = !showUserMenu"
            >
              <div class="flex items-center justify-center size-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-[11px] font-bold shadow-sm">
                {{ userInitials }}
              </div>
              <ChevronDown
                class="size-3 text-surface-400 transition-transform duration-200"
                :class="showUserMenu ? 'rotate-180' : ''"
              />
            </button>

            <!-- User dropdown -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 scale-95 -translate-y-1"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 -translate-y-1"
            >
              <div
                v-if="showUserMenu"
                class="absolute right-0 top-[calc(100%+6px)] w-64 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-xl shadow-surface-900/8 dark:shadow-surface-950/30 overflow-hidden"
              >
                <!-- User info header -->
                <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
                  <div class="text-sm font-semibold text-surface-900 dark:text-surface-100">{{ userName }}</div>
                  <div class="text-xs text-surface-500 dark:text-surface-400 truncate mt-0.5">{{ userEmail }}</div>
                </div>

                <!-- Mobile-only nav items -->
                <div class="md:hidden border-b border-surface-100 dark:border-surface-800 py-1">
                  <NuxtLink
                    v-for="item in mainNav"
                    :key="item.to"
                    :to="$localePath(item.to)"
                    class="flex items-center gap-2.5 px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100 transition-colors no-underline"
                    :class="isActiveRoute(item.to, item.exact) ? 'text-brand-600 dark:text-brand-400 font-medium' : ''"
                  >
                    <component :is="item.icon" class="size-4" />
                    {{ item.label }}
                  </NuxtLink>
                </div>

                <!-- Org switcher (mobile, only when multiple orgs exist) -->
                <div v-if="orgs && orgs.length > 1" class="lg:hidden border-b border-surface-100 dark:border-surface-800 p-2">
                  <OrgSwitcher />
                </div>

                <!-- Profile, Settings, Updates -->
                <div class="py-1 border-b border-surface-100 dark:border-surface-800">
                  <NuxtLink
                    :to="$localePath('/dashboard/settings/account')"
                    class="flex items-center gap-2.5 px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100 transition-colors no-underline"
                  >
                    <User class="size-4" />
                    Profile
                  </NuxtLink>
                  <NuxtLink
                    :to="$localePath('/dashboard/settings')"
                    class="flex items-center gap-2.5 px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100 transition-colors no-underline"
                  >
                    <Settings class="size-4" />
                    Settings
                  </NuxtLink>
                  <NuxtLink
                    :to="$localePath('/dashboard/updates')"
                    class="flex items-center gap-2.5 px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100 transition-colors no-underline"
                  >
                    <ArrowUpCircle class="size-4" />
                    Updates
                  </NuxtLink>
                  <button
                    v-if="isFeedbackEnabled"
                    class="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100 transition-colors cursor-pointer border-0 bg-transparent text-left"
                    @click="showFeedbackModal = true; showUserMenu = false"
                  >
                    <MessageSquarePlus class="size-4" />
                    Send Feedback
                  </button>
                </div>

                <!-- Color mode toggle -->
                <div class="py-1 border-b border-surface-100 dark:border-surface-800">
                  <button
                    class="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100 transition-colors cursor-pointer border-0 bg-transparent text-left"
                    @click="toggleColorMode()"
                  >
                    <Sun v-if="isDark" class="size-4" />
                    <Moon v-else class="size-4" />
                    {{ isDark ? 'Light mode' : 'Dark mode' }}
                  </button>
                </div>

                <!-- Sign out -->
                <div class="py-1">
                  <button
                    class="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-100 transition-colors cursor-pointer border-0 bg-transparent text-left"
                    :disabled="isSigningOut"
                    @click="handleSignOut"
                  >
                    <LogOut class="size-4" />
                    {{ isSigningOut ? 'Signing out…' : 'Sign out' }}
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Mobile hamburger -->
          <button
            class="flex md:hidden items-center justify-center size-8 rounded-lg text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200 cursor-pointer border-0 bg-transparent"
            @click="showMobileMenu = !showMobileMenu"
          >
            <X v-if="showMobileMenu" class="size-4" />
            <Menu v-else class="size-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Job context sub-navigation bar -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div
        v-if="activeJobId"
        class="relative z-10 border-b border-surface-200/60 dark:border-surface-800/60 bg-surface-50/90 dark:bg-surface-950/90 backdrop-blur-lg"
      >
        <div class="flex items-center h-10 px-4 lg:px-6 gap-2">
          <!-- Sidebar toggle -->
          <button
            class="flex items-center justify-center rounded-md p-1 transition-colors shrink-0 cursor-pointer border-0 bg-transparent hover:bg-surface-100 dark:hover:bg-surface-800"
            :class="showJobSidebar
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300'"
            :title="showJobSidebar ? 'Collapse sidebar' : 'Show jobs'"
            @click="showJobSidebar = !showJobSidebar"
          >
            <PanelLeftClose v-if="showJobSidebar" class="size-4" />
            <PanelLeftOpen v-else class="size-4" />
          </button>

          <div class="w-px h-4 bg-surface-200 dark:bg-surface-700 shrink-0" />

          <!-- Job title + status badge -->
          <Briefcase class="size-3.5 text-brand-500 shrink-0" />
          <span class="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate max-w-[160px] lg:max-w-[260px]">
            {{ activeJobTitle }}
          </span>
          <span
            v-if="activeJobStatus"
            class="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset"
            :class="jobStatusBadgeClasses[activeJobStatus] ?? 'bg-surface-50 text-surface-600 ring-surface-200'"
          >
            {{ activeJobStatus }}
          </span>

          <div class="w-px h-4 bg-surface-200 dark:bg-surface-700 shrink-0 ml-0.5" />

          <!-- View tabs -->
          <nav class="flex items-center gap-0.5">
            <NuxtLink
              v-for="tab in jobPipelineTabs"
              :key="tab.to"
              :to="$localePath(tab.to)"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 no-underline"
              :class="isActiveRoute(tab.to, tab.exact)
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
                : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-white/60 dark:hover:bg-surface-800/60'"
            >
              <component :is="tab.icon" class="size-3.5" />
              {{ tab.label }}
            </NuxtLink>

            <!-- Job config gear dropdown -->
            <div ref="configMenuRoot" class="relative">
              <button
                class="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer border-0 bg-transparent"
                :class="isConfigRouteActive || showConfigMenu
                  ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
                  : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-white/60 dark:hover:bg-surface-800/60'"
                title="Job settings"
                @click="showConfigMenu = !showConfigMenu"
              >
                <Cog class="size-3.5" />
                <ChevronDown class="size-2.5 transition-transform duration-150" :class="showConfigMenu ? 'rotate-180' : ''" />
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
                  v-if="showConfigMenu"
                  class="absolute left-0 top-[calc(100%+6px)] w-48 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-xl py-1.5 z-50"
                >
                  <p class="px-3 py-1.5 text-[10px] font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wider">Job Config</p>
                  <NuxtLink
                    v-for="tab in jobConfigTabs"
                    :key="tab.to"
                    :to="$localePath(tab.to)"
                    class="flex items-center gap-2.5 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800/80 transition-colors no-underline"
                    :class="isActiveRoute(tab.to, tab.exact) ? 'bg-surface-50 dark:bg-surface-800/60 font-medium' : ''"
                    @click="showConfigMenu = false"
                  >
                    <component :is="tab.icon" class="size-3.5 text-surface-400" />
                    {{ tab.label }}
                  </NuxtLink>
                </div>
              </Transition>
            </div>
          </nav>

          <!-- Right: page action slot (teleported from pipeline page) -->
          <div class="ml-auto flex items-center gap-2 shrink-0">
            <div id="job-sub-nav-actions" />
          </div>
        </div>
      </div>
    </Transition>

    <!-- Mobile navigation menu -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="showMobileMenu"
        class="relative z-10 md:hidden border-b border-surface-200 dark:border-surface-800 bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl"
      >
        <nav class="px-4 py-3 flex flex-col gap-1">
          <NuxtLink
            v-for="item in mainNav"
            :key="item.to"
            :to="$localePath(item.to)"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all no-underline"
            :class="isActiveRoute(item.to, item.exact)
              ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
              : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'"
          >
            <component :is="item.icon" class="size-4" />
            {{ item.label }}
          </NuxtLink>

          <!-- Get Started CTA (demo mode, mobile) -->
          <template v-if="isDemo">
            <div class="mt-2 pt-2 border-t border-surface-200 dark:border-surface-700">
              <p class="px-3 mb-1.5 text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Get Started</p>
              <NuxtLink
                :to="$localePath('/auth/fresh-signup')"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-950/60 transition-colors no-underline"
              >
                <Cloud class="size-4" />
                Cloud Hosted — Start Free
              </NuxtLink>
              <a
                href="https://github.com/reqcore-inc/reqcore#quick-start"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors no-underline mt-1"
              >
                <Server class="size-4" />
                Self-Host — Deploy Free
              </a>
            </div>
          </template>
        </nav>

        <div v-if="orgs && orgs.length > 1" class="px-4 pb-3 flex flex-col gap-2 border-t border-surface-100 dark:border-surface-800 pt-3 lg:hidden">
          <OrgSwitcher />
        </div>
      </div>
    </Transition>
  </header>

  <!-- Job sidebar panel (persistent push layout) -->
  <Transition
    enter-active-class="transition-transform duration-200 ease-out"
    enter-from-class="-translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition-transform duration-150 ease-in"
    leave-from-class="translate-x-0"
    leave-to-class="-translate-x-full"
  >
    <aside
      v-if="showJobSidebar && activeJobId"
      class="fixed left-0 z-40 w-64 border-r border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-y-auto"
      style="top: 6rem; height: calc(100vh - 6rem);"
    >
      <!-- Sidebar header -->
      <div class="flex items-center justify-between px-3 pt-3 pb-2">
        <p class="text-[10px] font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wider">Jobs</p>
        <NuxtLink
          :to="$localePath('/dashboard/jobs')"
          class="text-[10px] font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 no-underline"
        >
          View all
        </NuxtLink>
      </div>

      <!-- Job list with rich metadata -->
      <div class="px-2 pb-3 space-y-0.5">
        <NuxtLink
          v-for="sJob in sidebarJobs"
          :key="sJob.id"
          :to="$localePath(`/dashboard/jobs/${sJob.id}`)"
          class="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-all no-underline"
          :class="sJob.id === activeJobId
            ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800/60 hover:text-surface-900 dark:hover:text-surface-100'"
        >
          <Briefcase class="size-3.5 shrink-0 mt-0.5" :class="sJob.id === activeJobId ? 'text-brand-500' : 'text-surface-400'" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-medium leading-tight">{{ (sJob as any).title }}</p>
            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0 mt-1">
              <span
                class="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold capitalize ring-1 ring-inset"
                :class="jobStatusBadgeClasses[(sJob as any).status] ?? 'bg-surface-50 text-surface-600 ring-surface-200'"
              >
                {{ (sJob as any).status }}
              </span>
              <span v-if="(sJob as any).type" class="text-[10px] text-surface-400 dark:text-surface-500">
                {{ formatJobType((sJob as any).type) }}
              </span>
            </div>
            <div v-if="(sJob as any).location" class="flex items-center gap-1 mt-0.5">
              <MapPin class="size-2.5 text-surface-400 shrink-0" />
              <span class="text-[10px] text-surface-400 dark:text-surface-500 truncate">{{ (sJob as any).location }}</span>
            </div>
          </div>
        </NuxtLink>
        <div v-if="sidebarJobs.length === 0" class="py-6 text-center">
          <Briefcase class="size-5 mx-auto text-surface-300 dark:text-surface-600 mb-1.5" />
          <p class="text-xs text-surface-400">No jobs found</p>
        </div>
      </div>
    </aside>
  </Transition>

  <!-- Sidebar backdrop (mobile only) -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150"
    leave-to-class="opacity-0"
  >
    <div
      v-if="showJobSidebar && activeJobId"
      class="fixed inset-0 z-30 bg-black/20 lg:hidden"
      @click="showJobSidebar = false"
    />
  </Transition>

  <!-- Feedback modal -->
  <FeedbackModal v-if="showFeedbackModal" @close="showFeedbackModal = false" />
</template>
