import { eq, and } from 'drizzle-orm'
import { application, applicationAssessment, jobAssessmentTemplate } from '../../../../database/schema'
import { applicationIdParamSchema } from '../../../../utils/schemas/application'

/**
 * GET /api/applications/:id/assessment
 * Returns the assessment session for an application, including the template config.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['read'] })
  const orgId = session.session.activeOrganizationId

  const { id: applicationId } = await getValidatedRouterParams(event, applicationIdParamSchema.parse)

  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true, jobId: true },
  })
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const assessment = await db.query.applicationAssessment.findFirst({
    where: and(
      eq(applicationAssessment.applicationId, applicationId),
      eq(applicationAssessment.organizationId, orgId),
    ),
  })

  // Also fetch the template config for the job
  const template = await db.query.jobAssessmentTemplate.findFirst({
    where: and(
      eq(jobAssessmentTemplate.jobId, app.jobId),
      eq(jobAssessmentTemplate.organizationId, orgId),
    ),
  })

  return { data: assessment ?? null, template: template ?? null }
})
