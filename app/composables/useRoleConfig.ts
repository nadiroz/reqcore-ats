import { Crown, ShieldCheck, Shield } from 'lucide-vue-next'
import type { Component } from 'vue'

interface RoleConfig {
  label: string
  color: string
  bg: string
  icon: Component
}

const roleConfig: Record<string, RoleConfig> = {
  owner: { label: 'Owner', color: 'text-warning-700 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-950', icon: Crown },
  admin: { label: 'Admin', color: 'text-brand-700 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-950', icon: ShieldCheck },
  member: { label: 'Member', color: 'text-surface-700 dark:text-surface-300', bg: 'bg-surface-100 dark:bg-surface-800', icon: Shield },
}

/**
 * Shared role configuration for displaying role badges across the app.
 */
export function useRoleConfig() {
  function getRoleConfig(role: string): RoleConfig {
    return roleConfig[role] ?? roleConfig.member!
  }

  return { roleConfig, getRoleConfig }
}
