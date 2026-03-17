import { eq, and } from 'drizzle-orm'
import { job, jobAssessmentTemplate } from '../../../../database/schema'
import { idParamSchema } from '../../../../utils/schemas/job'

/**
 * GET /api/jobs/:id/assessment-template
 * Returns the assessment template for a job, or null if none exists.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['read'] })
  const orgId = session.session.activeOrganizationId

  const { id: jobId } = await getValidatedRouterParams(event, idParamSchema.parse)

  const j = await db.query.job.findFirst({
    where: and(eq(job.id, jobId), eq(job.organizationId, orgId)),
    columns: { id: true },
  })
  if (!j) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const template = await db.query.jobAssessmentTemplate.findFirst({
    where: and(
      eq(jobAssessmentTemplate.jobId, jobId),
      eq(jobAssessmentTemplate.organizationId, orgId),
    ),
  })

  return { data: template ?? null }
})
