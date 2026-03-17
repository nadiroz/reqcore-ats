import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { application, applicationTask, member } from '../../../../database/schema'
import { applicationIdParamSchema } from '../../../../utils/schemas/application'
import { createNotification } from '../../../../utils/notify'

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
})

/**
 * POST /api/applications/:id/tasks
 * Create a task for an application.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: applicationId } = await getValidatedRouterParams(event, applicationIdParamSchema.parse)
  const body = await readValidatedBody(event, createTaskSchema.parse)

  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true },
  })
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const [created] = await db.insert(applicationTask).values({
    organizationId: orgId,
    applicationId,
    title: body.title,
    description: body.description ?? null,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    createdById: session.user.id,
  }).returning()

  // Notify org members about the new task (fire-and-forget)
  db.query.member.findMany({
    where: eq(member.organizationId, orgId),
    columns: { userId: true },
  }).then((members) => {
    for (const m of members) {
      if (m.userId === session.user.id) continue
      createNotification({
        orgId,
        userId: m.userId,
        type: 'task_created',
        title: `New task: ${body.title}`,
        body: body.dueDate ? `Due ${new Date(body.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : undefined,
        resourceType: 'application',
        resourceId: applicationId,
      }).catch(() => {})
    }
  }).catch(() => {})

  setResponseStatus(event, 201)
  return created
})
