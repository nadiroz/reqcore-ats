import { eq, and, isNull } from 'drizzle-orm'
import { notification } from '../../database/schema'

/**
 * GET /api/notifications/unread-count
 * Returns the count of unread notifications for the current user.
 * Used by the notification bell badge.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const userId = session.user.id

  const count = await db.$count(
    notification,
    and(
      eq(notification.organizationId, orgId),
      eq(notification.userId, userId),
      isNull(notification.readAt),
    ),
  )

  return { count }
})
