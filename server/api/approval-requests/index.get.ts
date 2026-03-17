import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { stageApprovalRequest, application, candidate, job } from '../../database/schema'

const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'declined']).default('pending'),
})

/**
 * GET /api/approval-requests?status=pending
 * List approval requests assigned to the current user (or all pending for admins).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['read'] })
  const orgId = session.session.activeOrganizationId
  const userId = session.user.id

  const { status } = await getValidatedQuery(event, querySchema.parse)

  const requests = await db
    .select({
      id: stageApprovalRequest.id,
      fromStage: stageApprovalRequest.fromStage,
      toStage: stageApprovalRequest.toStage,
      status: stageApprovalRequest.status,
      note: stageApprovalRequest.note,
      createdAt: stageApprovalRequest.createdAt,
      requestedById: stageApprovalRequest.requestedById,
      assignedToId: stageApprovalRequest.assignedToId,
      applicationId: stageApprovalRequest.applicationId,
      candidateFirstName: candidate.firstName,
      candidateLastName: candidate.lastName,
      jobTitle: job.title,
    })
    .from(stageApprovalRequest)
    .innerJoin(application, eq(application.id, stageApprovalRequest.applicationId))
    .innerJoin(candidate, eq(candidate.id, application.candidateId))
    .innerJoin(job, eq(job.id, application.jobId))
    .where(and(
      eq(stageApprovalRequest.organizationId, orgId),
      eq(stageApprovalRequest.status, status),
      eq(stageApprovalRequest.assignedToId, userId),
    ))
    .orderBy(stageApprovalRequest.createdAt)
    .limit(50)

  return { data: requests, total: requests.length }
})
