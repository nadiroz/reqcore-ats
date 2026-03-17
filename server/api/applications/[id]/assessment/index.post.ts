import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { application, applicationAssessment, jobAssessmentTemplate } from '../../../../database/schema'
import { applicationIdParamSchema } from '../../../../utils/schemas/application'

const createAssessmentSchema = z.object({
  templateId: z.string().min(1).optional(),
  round1DueDate: z.string().datetime().optional(),
})

/**
 * POST /api/applications/:id/assessment
 * Start an assessment session for an application.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: applicationId } = await getValidatedRouterParams(event, applicationIdParamSchema.parse)
  const body = await readValidatedBody(event, createAssessmentSchema.parse)

  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true, jobId: true },
  })
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  // Check no existing assessment
  const existing = await db.query.applicationAssessment.findFirst({
    where: and(
      eq(applicationAssessment.applicationId, applicationId),
      eq(applicationAssessment.organizationId, orgId),
    ),
    columns: { id: true },
  })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Assessment already exists for this application.' })
  }

  // Resolve template
  let templateId = body.templateId ?? null
  if (!templateId) {
    const template = await db.query.jobAssessmentTemplate.findFirst({
      where: and(
        eq(jobAssessmentTemplate.jobId, app.jobId),
        eq(jobAssessmentTemplate.organizationId, orgId),
      ),
      columns: { id: true },
    })
    templateId = template?.id ?? null
  }

  const [created] = await db.insert(applicationAssessment).values({
    organizationId: orgId,
    applicationId,
    templateId,
    status: 'round1_sent',
    round1DueDate: body.round1DueDate ? new Date(body.round1DueDate) : null,
  }).returning()

  setResponseStatus(event, 201)
  return created
})
