import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { stageApprovalRequest, application } from '../../../../database/schema'

const resolveSchema = z.object({
  status: z.enum(['approved', 'declined']),
  resolverNote: z.string().max(2000).optional(),
})

const paramsSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
})

/**
 * PATCH /api/applications/:id/approval-requests/:requestId
 * Resolve an approval request (approve or decline).
 * On approval, automatically advances the application to the target stage.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: applicationId, requestId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, resolveSchema.parse)

  const request = await db.query.stageApprovalRequest.findFirst({
    where: and(
      eq(stageApprovalRequest.id, requestId),
      eq(stageApprovalRequest.applicationId, applicationId),
      eq(stageApprovalRequest.organizationId, orgId),
    ),
    columns: { id: true, status: true, fromStage: true, toStage: true, applicationId: true },
  })

  if (!request) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  if (request.status !== 'pending') {
    throw createError({ statusCode: 422, statusMessage: 'This request has already been resolved' })
  }

  const [updated] = await db.update(stageApprovalRequest)
    .set({
      status: body.status,
      resolverNote: body.resolverNote ?? null,
      resolvedAt: new Date(),
    })
    .where(eq(stageApprovalRequest.id, requestId))
    .returning()

  // On approval, advance the application to the target stage
  if (body.status === 'approved') {
    await db.update(application)
      .set({ status: request.toStage, updatedAt: new Date() })
      .where(and(
        eq(application.id, applicationId),
        eq(application.organizationId, orgId),
      ))

    recordActivity({
      organizationId: orgId,
      actorId: session.user.id,
      action: 'status_changed',
      resourceType: 'application',
      resourceId: applicationId,
      metadata: { from: request.fromStage, to: request.toStage, viaApproval: true },
    })
  }

  return updated
})
