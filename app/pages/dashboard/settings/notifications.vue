<script setup lang="ts">
import { Bell, Save, Loader2 } from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

useSeoMeta({
  title: 'Notification Settings — Reqcore',
})

const { allowed: canUpdate } = usePermission({ notification: ['update'] })

const NOTIFICATION_TYPES = [
  { key: 'application_status_changed', label: 'Application status changes', description: 'When a candidate moves to a new pipeline stage' },
  { key: 'comment_added', label: 'New comments', description: 'When a team member posts a comment on an application' },
  { key: 'approval_requested', label: 'Approval requests', description: 'When someone requests your approval for a stage transition' },
  { key: 'approval_resolved', label: 'Approval decisions', description: 'When your approval request is approved or declined' },
  { key: 'assessment_decision', label: 'Assessment decisions', description: 'When an assessment is evaluated with a final decision' },
  { key: 'interview_scheduled', label: 'Interview scheduled', description: 'When a new interview is created for an application' },
  { key: 'task_created', label: 'New tasks', description: 'When a task is added to an application' },
] as const

type NotificationType = typeof NOTIFICATION_TYPES[number]['key']

interface ChannelPrefs {
  inApp: boolean
  email: boolean
}

const { data: prefs, refresh } = useFetch('/api/notification-preferences', {
  key: 'notification-prefs',
  headers: useRequestHeaders(['cookie']),
})

const localPrefs = ref<Record<NotificationType, ChannelPrefs>>({} as any)
const isDirty = ref(false)
const isSaving = ref(false)
const saveSuccess = ref(false)
const saveError = ref('')

watch(prefs, (val) => {
  if (!isDirty.value && val) {
    const mapped: any = {}
    for (const t of NOTIFICATION_TYPES) {
      const existing = (val as any)[t.key]
      mapped[t.key] = {
        inApp: existing?.inApp !== false,
        email: existing?.email === true,
      }
    }
    localPrefs.value = mapped
  }
}, { immediate: true })

function markDirty() {
  isDirty.value = true
  saveError.value = ''
  saveSuccess.value = false
}

async function save() {
  if (!canUpdate.value) return
  isSaving.value = true
  saveError.value = ''
  saveSuccess.value = false

  try {
    await $fetch('/api/notification-preferences', {
      method: 'PATCH',
      body: localPrefs.value,
    })
    isDirty.value = false
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
    await refresh()
  } catch (err: any) {
    saveError.value = err?.data?.statusMessage ?? 'Failed to save notification preferences.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-surface-900 dark:text-surface-50">Notifications</h1>
      <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
        Control which notification types are delivered and through which channels. These are org-wide defaults.
      </p>
    </div>

    <div class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden">
      <!-- Header row -->
      <div class="grid grid-cols-[1fr_80px_80px] gap-4 px-6 py-3 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/30">
        <span class="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">Event</span>
        <span class="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider text-center">In-App</span>
        <span class="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider text-center">Email</span>
      </div>

      <!-- Rows -->
      <div class="divide-y divide-surface-100 dark:divide-surface-800">
        <div
          v-for="t in NOTIFICATION_TYPES"
          :key="t.key"
          class="grid grid-cols-[1fr_80px_80px] gap-4 items-center px-6 py-4"
        >
          <div>
            <div class="text-sm font-medium text-surface-800 dark:text-surface-200">{{ t.label }}</div>
            <div class="text-xs text-surface-400 dark:text-surface-500 mt-0.5">{{ t.description }}</div>
          </div>

          <!-- In-app toggle -->
          <div class="flex justify-center">
            <button
              :disabled="!canUpdate"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900 disabled:opacity-50 disabled:cursor-not-allowed"
              :class="localPrefs[t.key]?.inApp ? 'bg-brand-600' : 'bg-surface-200 dark:bg-surface-700'"
              @click="localPrefs[t.key].inApp = !localPrefs[t.key].inApp; markDirty()"
            >
              <span
                class="pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200"
                :class="localPrefs[t.key]?.inApp ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Email toggle -->
          <div class="flex justify-center">
            <button
              :disabled="!canUpdate"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900 disabled:opacity-50 disabled:cursor-not-allowed"
              :class="localPrefs[t.key]?.email ? 'bg-brand-600' : 'bg-surface-200 dark:bg-surface-700'"
              @click="localPrefs[t.key].email = !localPrefs[t.key].email; markDirty()"
            >
              <span
                class="pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200"
                :class="localPrefs[t.key]?.email ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <p class="text-xs text-surface-400 dark:text-surface-500 mt-3">
      Email delivery requires Novu and Resend to be configured. When disabled, only in-app notifications are sent.
    </p>

    <!-- Save error -->
    <div v-if="saveError" class="mt-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
      {{ saveError }}
    </div>

    <!-- Save bar -->
    <div v-if="isDirty" class="mt-4 flex items-center gap-3">
      <button
        :disabled="isSaving || !canUpdate"
        class="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        @click="save"
      >
        <Loader2 v-if="isSaving" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
        {{ isSaving ? 'Saving…' : 'Save preferences' }}
      </button>
    </div>

    <Transition
      enter-active-class="transition-opacity duration-300"
      leave-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <span v-if="saveSuccess" class="mt-3 inline-block text-sm text-success-600 dark:text-success-400 font-medium">
        Preferences saved
      </span>
    </Transition>
  </div>
</template>
