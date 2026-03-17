import { eq } from 'drizzle-orm'
import { userNotificationPreferences } from '../../database/schema'

/**
 * GET /api/notification-preferences/personal
 * Returns the current user's personal notification preference overrides.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const userId = session.user.id

  const row = await db.query.userNotificationPreferences.findFirst({
    where: eq(userNotificationPreferences.userId, userId),
    columns: { preferences: true },
  })

  return row?.preferences ?? {}
})
