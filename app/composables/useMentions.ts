/**
 * Composable for @mention autocomplete in comment textareas.
 * Fetches org members and provides matching logic + insertion helpers.
 */
export interface MentionMember {
  userId: string
  name: string
  email: string
  image: string | null
}

export function useMentions() {
  const members = ref<MentionMember[]>([])
  const isLoaded = ref(false)

  async function loadMembers() {
    if (isLoaded.value) return
    try {
      const result = await authClient.organization.listMembers()
      // better-auth listMembers returns { members, total }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: any[] = (result.data as any)?.members ?? (Array.isArray(result.data) ? result.data : [])
      if (list.length > 0) {
        members.value = list.map(m => ({
          userId: m.userId,
          name: m.user?.name ?? m.user?.email ?? 'Unknown',
          email: m.user?.email ?? '',
          image: m.user?.image ?? null,
        }))
      }
      isLoaded.value = true
    } catch {
      // silently fail; mentions just won't autocomplete
    }
  }

  function searchMembers(query: string): MentionMember[] {
    if (!query) return members.value.slice(0, 5)
    const q = query.toLowerCase()
    return members.value
      .filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 5)
  }

  /**
   * Parse mentions from comment body.
   * Mention format: @[Name](userId)
   * Returns array of mentioned user IDs.
   */
  function parseMentions(body: string): string[] {
    const regex = /@\[([^\]]+)\]\(([^)]+)\)/g
    const ids: string[] = []
    let match
    while ((match = regex.exec(body)) !== null) {
      if (match[2]) ids.push(match[2])
    }
    return [...new Set(ids)]
  }

  /**
   * Render mention markup as styled HTML.
   * @[Name](userId) -> <span class="mention">@Name</span>
   */
  function renderMentions(body: string): string {
    return body.replace(
      /@\[([^\]]+)\]\(([^)]+)\)/g,
      '<span class="inline-flex items-center rounded bg-brand-50 px-1 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 font-medium">@$1</span>',
    )
  }

  return { members, loadMembers, searchMembers, parseMentions, renderMentions }
}
