/**
 * Composable for in-app notifications.
 * Polls unread count every 30 seconds and provides fetch/mark-read helpers.
 */
export function useNotifications() {
  const headers = useRequestHeaders(['cookie'])

  // Unread count (polled)
  const { data: unreadData, refresh: refreshUnreadCount } = useFetch<{ count: number }>(
    '/api/notifications/unread-count',
    {
      key: 'notification-unread-count',
      headers,
      default: () => ({ count: 0 }),
    },
  )

  const unreadCount = computed(() => unreadData.value?.count ?? 0)

  // Poll every 30 seconds
  let pollInterval: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    pollInterval = setInterval(() => {
      refreshUnreadCount()
    }, 30_000)
  })

  onUnmounted(() => {
    if (pollInterval) clearInterval(pollInterval)
  })

  // Full notification list (fetched on demand)
  const { data: notificationData, refresh: refreshNotifications, status } = useFetch<{
    data: Array<{
      id: string
      type: string
      title: string
      body: string | null
      resourceType: string | null
      resourceId: string | null
      readAt: string | null
      createdAt: string
    }>
    total: number
  }>(
    '/api/notifications',
    {
      key: 'notification-list',
      query: { limit: 20 },
      headers,
      immediate: false,
      watch: false,
      default: () => ({ data: [], total: 0 }),
    },
  )

  const notifications = computed(() => notificationData.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function fetchNotifications() {
    await refreshNotifications()
  }

  async function markRead(id: string) {
    await $fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    // Optimistic: update local state
    const item = notifications.value.find(n => n.id === id)
    if (item) item.readAt = new Date().toISOString()
    await refreshUnreadCount()
  }

  async function markAllRead() {
    await $fetch('/api/notifications/mark-all-read', { method: 'POST' })
    // Optimistic: mark all as read locally
    for (const n of notifications.value) {
      if (!n.readAt) n.readAt = new Date().toISOString()
    }
    await refreshUnreadCount()
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markRead,
    markAllRead,
    refresh: async () => {
      await Promise.all([refreshUnreadCount(), refreshNotifications()])
    },
  }
}
