import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { application, applicationTask } from '../../../../database/schema'
import { applicationIdParamSchema } from '../../../../utils/schemas/application'

const paramsSchema = applicationIdParamSchema.extend({
  taskId: z.string().min(1),
})

/**
 * DELETE /api/applications/:id/tasks/:taskId
 * Remove a task.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: applicationId, taskId } = await getValidatedRouterParams(event, paramsSchema.parse)

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

  await db.delete(applicationTask).where(eq(applicationTask.id, taskId))

  return { success: true }
})
