import { eq, and } from 'drizzle-orm'
import { application, applicationTask } from '../../../../database/schema'
import { applicationIdParamSchema } from '../../../../utils/schemas/application'

/**
 * GET /api/applications/:id/tasks
 * List all tasks for an application.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['read'] })
  const orgId = session.session.activeOrganizationId

  const { id: applicationId } = await getValidatedRouterParams(event, applicationIdParamSchema.parse)

  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true },
  })
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const tasks = await db.query.applicationTask.findMany({
    where: and(
      eq(applicationTask.applicationId, applicationId),
      eq(applicationTask.organizationId, orgId),
    ),
    orderBy: applicationTask.createdAt,
  })

  return { data: tasks }
})
