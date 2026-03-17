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

const createTemplateSchema = z.object({
  config: z.object({
    rounds: z.array(roundSchema).min(1).max(5),
  }),
})

/**
 * POST /api/jobs/:id/assessment-template
 * Create or replace the assessment template for a job.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: jobId } = await getValidatedRouterParams(event, idParamSchema.parse)
  const body = await readValidatedBody(event, createTemplateSchema.parse)

  const j = await db.query.job.findFirst({
    where: and(eq(job.id, jobId), eq(job.organizationId, orgId)),
    columns: { id: true },
  })
  if (!j) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const [result] = await db.insert(jobAssessmentTemplate)
    .values({
      organizationId: orgId,
      jobId,
      config: body.config,
    })
    .onConflictDoUpdate({
      target: [jobAssessmentTemplate.organizationId, jobAssessmentTemplate.jobId],
      set: { config: body.config, updatedAt: new Date() },
    })
    .returning()

  setResponseStatus(event, 201)
  return result
})
