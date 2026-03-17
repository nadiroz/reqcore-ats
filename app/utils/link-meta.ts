/**
 * Link metadata utilities.
 *
 * Derives platform display name, icon key, display URL, and color from
 * a link's type and URL — entirely client-side, no external API calls.
 */

export type LinkPlatform =
  | 'GitHub'
  | 'LinkedIn'
  | 'Twitter'
  | 'Dribbble'
  | 'Behance'
  | 'Medium'
  | 'Portfolio'
  | 'Website'
  | 'Other'

export type LinkIconKey =
  | 'github'
  | 'linkedin'
  | 'twitter'
  | 'dribbble'
  | 'behance'
  | 'medium'
  | 'globe'
  | 'external-link'

export interface LinkMeta {
  platform: LinkPlatform
  /** Key for selecting the correct icon component */
  iconKey: LinkIconKey
  /** Cleaned URL without protocol/www for compact display */
  displayUrl: string
  /** Tailwind color class for the icon */
  iconColor: string
  /** Tailwind bg class for the icon chip */
  chipBg: string
}

// ─────────────────────────────────────────────
// Domain → platform mapping
// ─────────────────────────────────────────────

const DOMAIN_MAP: Array<{ pattern: RegExp; platform: LinkPlatform; iconKey: LinkIconKey; iconColor: string; chipBg: string }> = [
  {
    pattern: /github\.com/i,
    platform: 'GitHub',
    iconKey: 'github',
    iconColor: 'text-surface-800 dark:text-surface-200',
    chipBg: 'bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700',
  },
  {
    pattern: /linkedin\.com/i,
    platform: 'LinkedIn',
    iconKey: 'linkedin',
    iconColor: 'text-[#0077B5]',
    chipBg: 'bg-[#0077B5]/10 hover:bg-[#0077B5]/20 dark:bg-[#0077B5]/20 dark:hover:bg-[#0077B5]/30',
  },
  {
    pattern: /(?:twitter|x)\.com/i,
    platform: 'Twitter',
    iconKey: 'twitter',
    iconColor: 'text-surface-900 dark:text-surface-100',
    chipBg: 'bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700',
  },
  {
    pattern: /dribbble\.com/i,
    platform: 'Dribbble',
    iconKey: 'dribbble',
    iconColor: 'text-[#EA4C89]',
    chipBg: 'bg-[#EA4C89]/10 hover:bg-[#EA4C89]/20 dark:bg-[#EA4C89]/20 dark:hover:bg-[#EA4C89]/30',
  },
  {
    pattern: /behance\.net/i,
    platform: 'Behance',
    iconKey: 'behance',
    iconColor: 'text-[#1769FF]',
    chipBg: 'bg-[#1769FF]/10 hover:bg-[#1769FF]/20 dark:bg-[#1769FF]/20 dark:hover:bg-[#1769FF]/30',
  },
  {
    pattern: /medium\.com/i,
    platform: 'Medium',
    iconKey: 'medium',
    iconColor: 'text-surface-900 dark:text-surface-100',
    chipBg: 'bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700',
  },
]

// ─────────────────────────────────────────────
// Type → fallback mapping (when URL doesn't match a known domain)
// ─────────────────────────────────────────────

const TYPE_FALLBACK: Record<string, Pick<LinkMeta, 'platform' | 'iconKey' | 'iconColor' | 'chipBg'>> = {
  github: {
    platform: 'GitHub',
    iconKey: 'github',
    iconColor: 'text-surface-800 dark:text-surface-200',
    chipBg: 'bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700',
  },
  linkedin: {
    platform: 'LinkedIn',
    iconKey: 'linkedin',
    iconColor: 'text-[#0077B5]',
    chipBg: 'bg-[#0077B5]/10 hover:bg-[#0077B5]/20 dark:bg-[#0077B5]/20 dark:hover:bg-[#0077B5]/30',
  },
  portfolio: {
    platform: 'Portfolio',
    iconKey: 'globe',
    iconColor: 'text-brand-600 dark:text-brand-400',
    chipBg: 'bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:hover:bg-brand-950/60',
  },
  website: {
    platform: 'Website',
    iconKey: 'globe',
    iconColor: 'text-surface-600 dark:text-surface-400',
    chipBg: 'bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700',
  },
  other: {
    platform: 'Other',
    iconKey: 'external-link',
    iconColor: 'text-surface-500 dark:text-surface-400',
    chipBg: 'bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700',
  },
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Parse display metadata for a candidate link from its URL and type.
 *
 * @example
 * parseLinkMeta('https://github.com/nadir', 'github')
 * // { platform: 'GitHub', iconKey: 'github', displayUrl: 'github.com/nadir', ... }
 */
export function parseLinkMeta(url: string, type: string): LinkMeta {
  // Try to match by domain first (most accurate)
  for (const entry of DOMAIN_MAP) {
    if (entry.pattern.test(url)) {
      return {
        platform: entry.platform,
        iconKey: entry.iconKey,
        displayUrl: cleanDisplayUrl(url),
        iconColor: entry.iconColor,
        chipBg: entry.chipBg,
      }
    }
  }

  // Fall back to type-based metadata
  const fallback = TYPE_FALLBACK[type] ?? TYPE_FALLBACK.other!

  return {
    ...fallback,
    displayUrl: cleanDisplayUrl(url),
  }
}

/**
 * Strip protocol and www prefix for compact display.
 *
 * @example
 * cleanDisplayUrl('https://www.github.com/nadir') // 'github.com/nadir'
 */
export function cleanDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.host.replace(/^www\./, '')
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${host}${path}`
  }
  catch {
    // Not a valid URL — return as-is with protocol stripped
    return url.replace(/^https?:\/\/(www\.)?/, '')
  }
}
