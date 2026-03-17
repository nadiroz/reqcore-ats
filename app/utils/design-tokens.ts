/**
 * Design tokens for Reqcore UI.
 *
 * Import from here instead of hardcoding Tailwind class strings.
 * Every constant is `as const` so TypeScript can narrow the literal types.
 */

// ─────────────────────────────────────────────
// Card / panel padding
// ─────────────────────────────────────────────

export const CARD_PADDING = {
  /** Tight contexts: timeline items, dropdown rows, list rows */
  compact: 'p-4',
  /** Detail panels, slide-in panels, modal bodies */
  detail: 'p-6',
} as const

// ─────────────────────────────────────────────
// Avatar sizes
// ─────────────────────────────────────────────

export const AVATAR_SIZE = {
  /** Compact lists, notification rows, comment threads */
  list: 'size-8',
  /** Kanban cards, application cards */
  card: 'size-10',
  /** Candidate profile header, application header */
  profile: 'size-14',
} as const

// ─────────────────────────────────────────────
// Section / label typography
// ─────────────────────────────────────────────

export const SECTION_HEADER =
  'text-sm font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide' as const

export const FIELD_LABEL =
  'text-xs font-medium text-surface-500 dark:text-surface-400' as const

export const TIMESTAMP =
  'text-[11px] text-surface-400 dark:text-surface-500' as const

// ─────────────────────────────────────────────
// Section spacing
// ─────────────────────────────────────────────

export const SECTION_GAP = {
  /** Between top-level sections on a detail page */
  standard: 'space-y-6',
  /** Between items within a section */
  compact: 'space-y-4',
  /** Tight lists (timeline items, task rows) */
  tight: 'space-y-2',
} as const

// ─────────────────────────────────────────────
// Empty states
// ─────────────────────────────────────────────

export const EMPTY_STATE = {
  /** Wrapper: centers content vertically and horizontally */
  wrapper: 'flex flex-col items-center justify-center py-10 text-center',
  icon: 'size-8 text-surface-300 dark:text-surface-600 mb-3',
  heading: 'text-sm font-medium text-surface-600 dark:text-surface-400',
  subtext: 'text-xs text-surface-400 dark:text-surface-500 mt-1',
  cta: 'mt-4 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300',
} as const

// ─────────────────────────────────────────────
// Badge / ring patterns (for non-stage badges)
// ─────────────────────────────────────────────

export const BADGE = {
  base: 'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset' as const,
  surface: 'bg-surface-100 text-surface-600 ring-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:ring-surface-700' as const,
  brand: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-800' as const,
  success: 'bg-success-50 text-success-700 ring-success-200 dark:bg-success-950/50 dark:text-success-300 dark:ring-success-800' as const,
  warning: 'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-950/50 dark:text-warning-300 dark:ring-warning-800' as const,
  danger: 'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-950/50 dark:text-danger-300 dark:ring-danger-800' as const,
  amber: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800' as const,
} as const

// ─────────────────────────────────────────────
// Interactive surface buttons (icon buttons, ghost rows)
// ─────────────────────────────────────────────

export const GHOST_BUTTON =
  'rounded-md p-1.5 text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer border-0 bg-transparent' as const

export const ICON_BUTTON =
  'flex items-center justify-center size-7 rounded-md text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer border-0 bg-transparent' as const

// ─────────────────────────────────────────────
// Dividers
// ─────────────────────────────────────────────

export const DIVIDER = {
  horizontal: 'border-t border-surface-100 dark:border-surface-800' as const,
  vertical: 'w-px bg-surface-200 dark:bg-surface-700' as const,
} as const
