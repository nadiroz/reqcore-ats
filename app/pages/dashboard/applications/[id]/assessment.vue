<script setup lang="ts">
import { ArrowLeft, Send, FileCheck, ClipboardCheck, CheckCircle2 } from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

const route = useRoute()
const localePath = useLocalePath()
const applicationId = route.params.id as string

const { data: applicationData, status: fetchStatus } = useFetch<{
  id: string
  status: string
  score: number | null
  candidate: { firstName: string; lastName: string; email: string }
  job: { id: string; title: string }
}>(`/api/applications/${applicationId}`, {
  headers: useRequestHeaders(['cookie']),
})

const candidateName = computed(() => {
  const app = applicationData.value
  if (!app) return ''
  return `${app.candidate.firstName} ${app.candidate.lastName}`
})

const jobTitle = computed(() => applicationData.value?.job?.title ?? '')

// Assessment steps
const steps = [
  { id: 'send', label: 'Send', icon: Send },
  { id: 'submitted', label: 'Submitted', icon: FileCheck },
  { id: 'evaluate', label: 'Evaluate', icon: ClipboardCheck },
  { id: 'decide', label: 'Decide', icon: CheckCircle2 },
] as const

// For now, step tracking is static. Full wiring comes in Wave G.
const currentStep = ref(0)

useSeoMeta({
  title: computed(() =>
    candidateName.value
      ? `Assessment | ${candidateName.value} | Reqcore`
      : 'Assessment | Reqcore',
  ),
  robots: 'noindex, nofollow',
})
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <!-- Back link -->
    <NuxtLink
      :to="localePath(`/dashboard/applications/${applicationId}`)"
      class="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300 mb-6 transition-colors"
    >
      <ArrowLeft class="size-4" />
      Back to Application
    </NuxtLink>

    <!-- Loading -->
    <div v-if="fetchStatus === 'pending'" class="flex items-center justify-center py-20">
      <div class="size-8 rounded-full border-2 border-brand-200 border-t-brand-600 dark:border-brand-800 dark:border-t-brand-400 animate-spin" />
    </div>

    <template v-else-if="applicationData">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-xl font-semibold text-surface-900 dark:text-surface-50">
          Assessment: {{ candidateName }}
        </h1>
        <p class="mt-1 text-sm text-surface-500 dark:text-surface-400">
          {{ jobTitle }}
        </p>
      </div>

      <!-- Step indicator -->
      <div class="mb-10">
        <div class="flex items-center justify-between">
          <template v-for="(step, i) in steps" :key="step.id">
            <!-- Step node -->
            <div class="flex flex-col items-center gap-1.5">
              <div
                class="flex size-10 items-center justify-center rounded-full border-2 transition-all"
                :class="i <= currentStep
                  ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/40'
                  : 'border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900'"
              >
                <component
                  :is="step.icon"
                  class="size-4.5"
                  :class="i <= currentStep
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-surface-400 dark:text-surface-500'"
                />
              </div>
              <span
                class="text-xs font-medium"
                :class="i <= currentStep
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-surface-400 dark:text-surface-500'"
              >
                {{ step.label }}
              </span>
            </div>

            <!-- Connector line -->
            <div
              v-if="i < steps.length - 1"
              class="flex-1 h-px mx-3 -mt-5"
              :class="i < currentStep
                ? 'bg-brand-400 dark:bg-brand-600'
                : 'bg-surface-200 dark:bg-surface-700'"
            />
          </template>
        </div>
      </div>

      <!-- Step content placeholder -->
      <div class="rounded-xl border border-surface-200/80 bg-white p-8 dark:border-surface-800/60 dark:bg-surface-900">
        <!-- Step 1: Send -->
        <div v-if="currentStep === 0" class="text-center">
          <Send class="size-8 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
          <h2 class="text-base font-semibold text-surface-800 dark:text-surface-200 mb-1">
            Send Assessment Brief
          </h2>
          <p class="text-sm text-surface-500 dark:text-surface-400 mb-6 max-w-md mx-auto">
            Configure the assessment template and send it to the candidate. The template is defined on the job's assessment settings.
          </p>
          <div class="flex items-center justify-center gap-3">
            <NuxtLink
              :to="localePath(`/dashboard/jobs/${applicationData.job?.id}/assessment`)"
              class="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 dark:border-surface-700 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
            >
              View Template
            </NuxtLink>
            <button
              class="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm cursor-pointer"
              @click="currentStep = 1"
            >
              <Send class="size-3.5" />
              Send to Candidate
            </button>
          </div>
        </div>

        <!-- Step 2: Submitted (read-only) -->
        <div v-else-if="currentStep === 1" class="text-center">
          <FileCheck class="size-8 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
          <h2 class="text-base font-semibold text-surface-800 dark:text-surface-200 mb-1">
            Awaiting Submission
          </h2>
          <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
            The assessment has been sent. Waiting for the candidate to submit their responses.
          </p>
          <button
            class="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium cursor-pointer"
            @click="currentStep = 2"
          >
            Skip to Evaluate (demo)
          </button>
        </div>

        <!-- Step 3: Evaluate -->
        <div v-else-if="currentStep === 2" class="text-center">
          <ClipboardCheck class="size-8 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
          <h2 class="text-base font-semibold text-surface-800 dark:text-surface-200 mb-1">
            Evaluate Responses
          </h2>
          <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
            Score each task, add behavioral notes. Full scoring UI will be wired in Wave G.
          </p>
          <button
            class="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium cursor-pointer"
            @click="currentStep = 3"
          >
            Skip to Decision (demo)
          </button>
        </div>

        <!-- Step 4: Decide -->
        <div v-else class="text-center">
          <CheckCircle2 class="size-8 text-success-400 dark:text-success-500 mx-auto mb-3" />
          <h2 class="text-base font-semibold text-surface-800 dark:text-surface-200 mb-1">
            Make Decision
          </h2>
          <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
            Record your hiring decision. Full decision UI will be wired in Wave G.
          </p>
          <div class="flex items-center justify-center gap-3">
            <button class="rounded-lg border border-surface-200 dark:border-surface-700 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer">
              Borderline
            </button>
            <button class="rounded-lg bg-danger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-danger-700 transition-colors cursor-pointer">
              No Hire
            </button>
            <button class="rounded-lg bg-success-600 px-4 py-2 text-sm font-semibold text-white hover:bg-success-700 transition-colors shadow-sm cursor-pointer">
              Hire
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
