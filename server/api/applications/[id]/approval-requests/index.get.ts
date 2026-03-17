import { eq, and } from 'drizzle-orm'
import { application, stageApprovalRequest } from '../../../../database/schema'
import { applicationIdParamSchema } from '../../../../utils/schemas/application'

/**
 * GET /api/applications/:id/approval-requests
 * List pending approval requests for an application.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['read'] })
  const orgId = session.session.activeOrganizationId

  const { id: applicationId } = await getValidatedRouterParams(event, applicationIdParamSchema.parse)

  // Verify application belongs to this org
  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true },
  })
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const requests = await db.query.stageApprovalRequest.findMany({
    where: and(
      eq(stageApprovalRequest.applicationId, applicationId),
      eq(stageApprovalRequest.organizationId, orgId),
    ),
    columns: {
      id: true, fromStage: true, toStage: true, status: true,
      note: true, resolverNote: true, createdAt: true, resolvedAt: true,
      requestedById: true, assignedToId: true,
    },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  })

  return requests
})
