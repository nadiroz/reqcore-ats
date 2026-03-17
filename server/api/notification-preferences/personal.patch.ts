import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { userNotificationPreferences } from '../../database/schema'

const channelPrefsSchema = z.object({
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
})

const patchBodySchema = z.record(
  z.enum([
    'application_status_changed',
    'comment_added',
    'approval_requested',
    'approval_resolved',
    'assessment_decision',
    'interview_scheduled',
    'task_created',
  ]),
  channelPrefsSchema,
)

/**
 * PATCH /api/notification-preferences/personal
 * Update the current user's personal notification preference overrides.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const userId = session.user.id

  const body = await readValidatedBody(event, patchBodySchema.parse)

  const existing = await db.query.userNotificationPreferences.findFirst({
    where: eq(userNotificationPreferences.userId, userId),
    columns: { preferences: true },
  })

  const merged = { ...existing?.preferences, ...body }

  await db.insert(userNotificationPreferences)
    .values({
      userId,
      preferences: merged,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userNotificationPreferences.userId,
      set: { preferences: merged, updatedAt: new Date() },
    })

  return merged
})
