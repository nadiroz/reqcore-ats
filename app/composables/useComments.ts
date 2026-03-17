import type { MaybeRefOrGetter } from 'vue'

export interface Comment {
  id: string
  targetType: 'candidate' | 'application' | 'job'
  targetId: string
  body: string
  parentId: string | null
  authorId: string
  authorName: string
  authorEmail: string
  authorImage: string | null
  createdAt: string
  updatedAt: string
}

export interface ThreadedComment extends Comment {
  replies: Comment[]
}

interface CommentListResponse {
  data: Comment[]
  total: number
  page: number
  limit: number
}

/**
 * Composable for listing and managing comments on a target entity.
 * Supports threaded comments (one level of nesting).
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
    immediate: false,
  })

  // Fetch when query becomes valid; re-fetch on change
  watch(query, (q) => { if (q) refresh() }, { immediate: true })

  const comments = computed<Comment[]>(() => (data.value as CommentListResponse | null)?.data ?? [])
  const total = computed<number>(() => (data.value as CommentListResponse | null)?.total ?? 0)
  const isLoading = computed(() => status.value === 'pending')

  /** Top-level comments with their replies grouped underneath. */
  const threaded = computed<ThreadedComment[]>(() => {
    const all = comments.value
    const topLevel = all.filter(c => !c.parentId)
    const replyMap = new Map<string, Comment[]>()
    for (const c of all) {
      if (c.parentId) {
        const list = replyMap.get(c.parentId) ?? []
        list.push(c)
        replyMap.set(c.parentId, list)
      }
    }
    return topLevel.map(c => ({
      ...c,
      replies: (replyMap.get(c.id) ?? []).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    }))
  })

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

  async function createReply(parentId: string, body: string) {
    const targetId = toValue(options.targetId)
    if (!targetId) return
    try {
      await $fetch('/api/comments', {
        method: 'POST',
        body: {
          targetType: toValue(options.targetType),
          targetId,
          body,
          parentId,
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

  return {
    comments, threaded, total, isLoading, status, error, refresh,
    createComment, createReply, updateComment, deleteComment,
  }
}
