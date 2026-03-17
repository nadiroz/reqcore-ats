import type { MaybeRefOrGetter } from 'vue'

export interface Comment {
  id: string
  targetType: 'candidate' | 'application' | 'job'
  targetId: string
  body: string
  authorId: string
  authorName: string
  authorEmail: string
  authorImage: string | null
  createdAt: string
  updatedAt: string
}

interface CommentListResponse {
  data: Comment[]
  total: number
  page: number
  limit: number
}

/**
 * Composable for listing and managing comments on a target entity.
 */
export function useComments(options: {
  targetType: MaybeRefOrGetter<'candidate' | 'application' | 'job'>
  targetId: MaybeRefOrGetter<string | undefined>
  limit?: MaybeRefOrGetter<number>
}) {
  const { handlePreviewReadOnlyError } = usePreviewReadOnly()

  const query = computed(() => {
    const targetId = toValue(options.targetId)
    if (!targetId) return null
    return {
      targetType: toValue(options.targetType),
      targetId,
      page: 1,
      limit: toValue(options.limit) ?? 50,
    }
  })

  const fetchKey = computed(() => {
    const q = query.value
    if (!q) return 'comments-none'
    return `comments-${q.targetType}-${q.targetId}`
  })

  const { data, status, error, refresh } = useFetch<CommentListResponse>('/api/comments', {
    key: fetchKey,
    query: computed(() => query.value ?? {}),
    headers: useRequestHeaders(['cookie']),
    immediate: computed(() => !!query.value),
  })

  const comments = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.total ?? 0)
  const isLoading = computed(() => status.value === 'pending')

  async function createComment(body: string) {
    const targetId = toValue(options.targetId)
    if (!targetId) return
    try {
      await $fetch('/api/comments', {
        method: 'POST',
        body: {
          targetType: toValue(options.targetType),
          targetId,
          body,
        },
      })
      await refresh()
    } catch (err) {
      handlePreviewReadOnlyError(err)
      throw err
    }
  }

  async function updateComment(id: string, body: string) {
    try {
      await $fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        body: { body },
      })
      await refresh()
    } catch (err) {
      handlePreviewReadOnlyError(err)
      throw err
    }
  }

  async function deleteComment(id: string) {
    try {
      await $fetch(`/api/comments/${id}`, { method: 'DELETE' })
      await refresh()
    } catch (err) {
      handlePreviewReadOnlyError(err)
      throw err
    }
  }

  return { comments, total, isLoading, status, error, refresh, createComment, updateComment, deleteComment }
}
