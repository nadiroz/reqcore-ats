import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { job, jobAssessmentTemplate } from '../../../../database/schema'
import { idParamSchema } from '../../../../utils/schemas/job'

const taskSchema = z.object({
  label: z.string().min(1).max(200),
  weight: z.number().min(0).max(100),
  passCriteria: z.array(z.string().max(500)).default([]),
  failCriteria: z.array(z.string().max(500)).default([]),
})

const roundSchema = z.object({
  label: z.string().min(1).max(200),
  tasks: z.array(taskSchema).min(1),
})

const patchTemplateSchema = z.object({
  config: z.object({
    rounds: z.array(roundSchema).min(1).max(5),
  }),
})

/**
 * PATCH /api/jobs/:id/assessment-template
 * Update the assessment template config.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: jobId } = await getValidatedRouterParams(event, idParamSchema.parse)
  const body = await readValidatedBody(event, patchTemplateSchema.parse)

  const j = await db.query.job.findFirst({
    where: and(eq(job.id, jobId), eq(job.organizationId, orgId)),
    columns: { id: true },
  })
  if (!j) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const existing = await db.query.jobAssessmentTemplate.findFirst({
    where: and(
      eq(jobAssessmentTemplate.jobId, jobId),
      eq(jobAssessmentTemplate.organizationId, orgId),
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'No assessment template exists for this job. Use POST to create one.' })
  }

  const [updated] = await db.update(jobAssessmentTemplate)
    .set({ config: body.config, updatedAt: new Date() })
    .where(eq(jobAssessmentTemplate.id, existing.id))
    .returning()

  return updated
})
