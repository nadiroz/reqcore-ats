export interface ApplicationTask {
  id: string
  applicationId: string
  title: string
  description: string | null
  taskType: string
  dueDate: string | null
  completedAt: string | null
  completedById: string | null
  createdById: string
  createdAt: string
  updatedAt: string
}

interface TasksResponse {
  data: ApplicationTask[]
}

/**
 * Composable for managing tasks on an application.
 */
export function useApplicationTasks(applicationId: MaybeRefOrGetter<string | null | undefined>) {
  const resolvedId = computed(() => toValue(applicationId))

  const { data, status, refresh } = useFetch<TasksResponse>(
    () => resolvedId.value ? `/api/applications/${resolvedId.value}/tasks` : '',
    {
      key: computed(() => `app-tasks-${resolvedId.value}`).value,
      headers: useRequestHeaders(['cookie']),
      immediate: !!toValue(applicationId),
      watch: [resolvedId],
    },
  )

  const tasks = computed<ApplicationTask[]>(() => data.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')
  const openTasksCount = computed(() => tasks.value.filter(t => !t.completedAt).length)

  async function createTask(title: string, opts?: { description?: string; dueDate?: string }) {
    const id = resolvedId.value
    if (!id) return
    await $fetch(`/api/applications/${id}/tasks`, {
      method: 'POST',
      body: { title, description: opts?.description, dueDate: opts?.dueDate },
    })
    await refresh()
  }

  async function toggleTask(taskId: string, completed: boolean) {
    const id = resolvedId.value
    if (!id) return
    await $fetch(`/api/applications/${id}/tasks/${taskId}`, {
      method: 'PATCH',
      body: { completed },
    })
    await refresh()
  }

  async function deleteTask(taskId: string) {
    const id = resolvedId.value
    if (!id) return
    await $fetch(`/api/applications/${id}/tasks/${taskId}`, {
      method: 'DELETE',
    })
    await refresh()
  }

  return { tasks, openTasksCount, isLoading, createTask, toggleTask, deleteTask, refresh }
}
