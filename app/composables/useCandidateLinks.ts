import type { MaybeRefOrGetter } from 'vue'

export interface CandidateLink {
  id: string
  type: string
  url: string
  label: string | null
  createdAt: string
}

export type LinkType = 'github' | 'linkedin' | 'portfolio' | 'website' | 'other'
export const VALID_LINK_TYPES: LinkType[] = ['github', 'linkedin', 'portfolio', 'website', 'other']

export const LINK_TYPE_LABELS: Record<string, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  portfolio: 'Portfolio',
  website: 'Website',
  other: 'Other',
}

/**
 * Composable for listing and managing external profile links for a candidate.
 */
export function useCandidateLinks(candidateId: MaybeRefOrGetter<string | undefined>) {
  const { handlePreviewReadOnlyError } = usePreviewReadOnly()

  const fetchKey = computed(() => {
    const id = toValue(candidateId)
    return id ? `candidate-links-${id}` : 'candidate-links-none'
  })

  const { data, status, error, refresh } = useFetch<CandidateLink[]>(
    () => `/api/candidates/${toValue(candidateId)}/links`,
    {
      key: fetchKey,
      headers: useRequestHeaders(['cookie']),
      immediate: false,
    },
  )

  // Fetch when candidateId becomes available; re-fetch on change
  watch(
    () => toValue(candidateId),
    (id) => { if (id) refresh() },
    { immediate: true },
  )

  const links = computed<CandidateLink[]>(() => (data.value as CandidateLink[] | null) ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function addLink(payload: { type: string; url: string; label?: string }) {
    const id = toValue(candidateId)
    if (!id) return
    try {
      await $fetch(`/api/candidates/${id}/links`, {
        method: 'POST',
        body: payload,
      })
      await refresh()
    }
    catch (err) {
      handlePreviewReadOnlyError(err)
      throw err
    }
  }

  async function removeLink(linkId: string) {
    const id = toValue(candidateId)
    if (!id) return
    try {
      await $fetch(`/api/candidates/${id}/links/${linkId}`, { method: 'DELETE' })
      await refresh()
    }
    catch (err) {
      handlePreviewReadOnlyError(err)
      throw err
    }
  }

  return { links, isLoading, error, refresh, addLink, removeLink }
}
