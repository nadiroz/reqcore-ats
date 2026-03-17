import { eq, and, isNull } from 'drizzle-orm'
import { notification } from '../../database/schema'

/**
 * POST /api/notifications/mark-all-read
 * Mark all unread notifications as read for the current user.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const userId = session.user.id

  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(
      eq(notification.organizationId, orgId),
      eq(notification.userId, userId),
      isNull(notification.readAt),
    ))

  return { success: true }
})
