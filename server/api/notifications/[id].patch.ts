import { eq, and } from 'drizzle-orm'
import { notification } from '../../database/schema'

/**
 * PATCH /api/notifications/:id
 * Mark a single notification as read.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const userId = session.user.id
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing notification ID' })
  }

  const [updated] = await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(
      eq(notification.id, id),
      eq(notification.organizationId, orgId),
      eq(notification.userId, userId),
    ))
    .returning({ id: notification.id })

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Notification not found' })
  }

  return { success: true }
})
