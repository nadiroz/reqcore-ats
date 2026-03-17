import { eq, and, desc, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { notification } from '../../database/schema'

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20),
  page: z.coerce.number().min(1).default(1),
})

/**
 * GET /api/notifications
 * List notifications for the current user, unread first, newest first.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const userId = session.user.id

  const { limit, page } = await getValidatedQuery(event, querySchema.parse)
  const offset = (page - 1) * limit

  const where = and(
    eq(notification.organizationId, orgId),
    eq(notification.userId, userId),
  )

  const [data, total] = await Promise.all([
    db
      .select()
      .from(notification)
      .where(where)
      .orderBy(isNull(notification.readAt), desc(notification.createdAt))
      .limit(limit)
      .offset(offset),
    db.$count(notification, where),
  ])

  return { data, total, page, limit }
})
