import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { application, stageApprovalRequest } from '../../../../database/schema'
import { applicationIdParamSchema } from '../../../../utils/schemas/application'

const createApprovalRequestSchema = z.object({
  toStage: z.string().min(1),
  assignedToId: z.string().min(1).optional(),
  note: z.string().max(2000).optional(),
})

/**
 * POST /api/applications/:id/approval-requests
 * Create an approval request for a stage transition.
 * The application stays in its current stage until the request is resolved.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: applicationId } = await getValidatedRouterParams(event, applicationIdParamSchema.parse)
  const body = await readValidatedBody(event, createApprovalRequestSchema.parse)

  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true, status: true },
  })
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const [created] = await db.insert(stageApprovalRequest).values({
    organizationId: orgId,
    applicationId,
    fromStage: app.status,
    toStage: body.toStage,
    requestedById: session.user.id,
    assignedToId: body.assignedToId ?? null,
    note: body.note ?? null,
  }).returning()

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'updated',
    resourceType: 'application',
    resourceId: applicationId,
    metadata: { approvalRequested: true, toStage: body.toStage },
  })

  setResponseStatus(event, 201)
  return created
})
