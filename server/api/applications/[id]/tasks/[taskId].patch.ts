import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { application, applicationTask } from '../../../../database/schema'
import { applicationIdParamSchema } from '../../../../utils/schemas/application'

const paramsSchema = applicationIdParamSchema.extend({
  taskId: z.string().min(1),
})

const patchTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  completed: z.boolean().optional(),
})

/**
 * PATCH /api/applications/:id/tasks/:taskId
 * Update or toggle a task.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: applicationId, taskId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, patchTaskSchema.parse)

  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true },
  })
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const existing = await db.query.applicationTask.findFirst({
    where: and(
      eq(applicationTask.id, taskId),
      eq(applicationTask.applicationId, applicationId),
      eq(applicationTask.organizationId, orgId),
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.title !== undefined) updates.title = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null

  if (body.completed !== undefined) {
    if (body.completed) {
      updates.completedAt = new Date()
      updates.completedById = session.user.id
    } else {
      updates.completedAt = null
      updates.completedById = null
    }
  }

  const [updated] = await db.update(applicationTask)
    .set(updates)
    .where(eq(applicationTask.id, taskId))
    .returning()

  return updated
})
