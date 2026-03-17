import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { orgSettings } from '../../database/schema'

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
 * PATCH /api/notification-preferences
 * Update the org's notification delivery preferences.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { notification: ['update'] })
  const orgId = session.session.activeOrganizationId

  const body = await readValidatedBody(event, patchBodySchema.parse)

  // Merge with existing prefs
  const existing = await db.query.orgSettings.findFirst({
    where: eq(orgSettings.organizationId, orgId),
    columns: { notificationPreferences: true },
  })

  const merged = { ...existing?.notificationPreferences, ...body }

  await db.insert(orgSettings)
    .values({
      organizationId: orgId,
      notificationPreferences: merged,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: orgSettings.organizationId,
      set: { notificationPreferences: merged, updatedAt: new Date() },
    })

  return merged
})
