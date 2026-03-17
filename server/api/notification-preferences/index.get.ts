import { eq } from 'drizzle-orm'
import { orgSettings } from '../../database/schema'
import type { NotificationPreferences } from '../../database/schema'

const DEFAULT_PREFS: NotificationPreferences = {
  application_status_changed: { inApp: true, email: false },
  comment_added: { inApp: true, email: false },
  approval_requested: { inApp: true, email: false },
  approval_resolved: { inApp: true, email: false },
  assessment_decision: { inApp: true, email: false },
  interview_scheduled: { inApp: true, email: false },
  task_created: { inApp: true, email: false },
}

/**
 * GET /api/notification-preferences
 * Returns the org's notification delivery preferences, falling back to defaults.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { notification: ['read'] })
  const orgId = session.session.activeOrganizationId

  const settings = await db.query.orgSettings.findFirst({
    where: eq(orgSettings.organizationId, orgId),
    columns: { notificationPreferences: true },
  })

  return settings?.notificationPreferences ?? DEFAULT_PREFS
})
