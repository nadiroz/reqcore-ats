/**
 * Global keyboard shortcuts composable.
 * Registers shortcuts on mount, cleans up on unmount.
 * Ignores keypresses when user is typing in an input/textarea/contenteditable.
 */

interface ShortcutHandler {
  /** Key to listen for (e.g. 'k', 'Escape', 'ArrowDown') */
  key: string
  /** Require Cmd (Mac) or Ctrl (Win/Linux) */
  meta?: boolean
  /** Require Shift */
  shift?: boolean
  /** Handler function. Return false to prevent default. */
  handler: (e: KeyboardEvent) => void | false
  /** Optional description for help overlay */
  description?: string
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  function isTyping(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null
    if (!target) return false
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (target.isContentEditable) return true
    return false
  }

  function onKeyDown(e: KeyboardEvent) {
    for (const s of shortcuts) {
      const metaMatch = s.meta ? (e.metaKey || e.ctrlKey) : true
      const shiftMatch = s.shift ? e.shiftKey : true
      const keyMatch = e.key === s.key || e.key.toLowerCase() === s.key.toLowerCase()

      if (!metaMatch || !shiftMatch || !keyMatch) continue

      // For shortcuts without meta/shift modifiers, ignore when typing
      if (!s.meta && !s.shift && isTyping(e)) continue

      const result = s.handler(e)
      if (result !== false) {
        e.preventDefault()
        e.stopPropagation()
      }
      return
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown)
  })

  return { shortcuts }
}
