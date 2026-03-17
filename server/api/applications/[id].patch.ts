import { eq, and } from 'drizzle-orm'
import { application, orgSettings, member, candidate, job, organization } from '../../database/schema'
import { applicationIdParamSchema, updateApplicationSchema } from '../../utils/schemas/application'
import { computeTransitions, DEFAULT_PIPELINE_STAGES } from '~~/shared/status-transitions'
import { createNotification, notifyCandidateStatusChange } from '../../utils/notify'

/**
 * PATCH /api/applications/:id
 * Update application status (with server-side transition validation), notes, and score.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id } = await getValidatedRouterParams(event, applicationIdParamSchema.parse)
  const body = await readValidatedBody(event, updateApplicationSchema.parse)

  // Fetch current application to validate status transition
  const current = await db.query.application.findFirst({
    where: and(eq(application.id, id), eq(application.organizationId, orgId)),
    columns: { id: true, status: true },
  })

  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  // Load pipeline stages for validation and candidate notification
  let pipelineStages = DEFAULT_PIPELINE_STAGES
  if (body.status && body.status !== current.status) {
    try {
      const settings = await db.query.orgSettings.findFirst({
        where: eq(orgSettings.organizationId, orgId),
        columns: { pipelineConfig: true },
      })
      pipelineStages = settings?.pipelineConfig?.stages ?? DEFAULT_PIPELINE_STAGES
    } catch (e) {
      console.error('[pipeline-config] Falling back to defaults:', e)
    }
    const transitions = computeTransitions(pipelineStages)
    const allowed = transitions[current.status] ?? []
    if (!allowed.includes(body.status)) {
      throw createError({
        statusCode: 422,
        statusMessage: `Cannot transition from "${current.status}" to "${body.status}". Allowed: ${allowed.join(', ') || 'none'}`,
      })
    }
  }

  const [updated] = await db.update(application)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(application.id, id), eq(application.organizationId, orgId)))
    .returning({
      id: application.id,
      candidateId: application.candidateId,
      jobId: application.jobId,
      status: application.status,
      score: application.score,
      notes: application.notes,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    })

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: body.status && body.status !== current.status ? 'status_changed' : 'updated',
    resourceType: 'application',
    resourceId: id,
    metadata: body.status && body.status !== current.status
      ? { from: current.status, to: body.status }
      : undefined,
  })

  // Notify org members of status changes (fire-and-forget)
  if (body.status && body.status !== current.status) {
    db.query.member.findMany({
      where: eq(member.organizationId, orgId),
      columns: { userId: true },
    }).then((members) => {
      for (const m of members) {
        if (m.userId === session.user.id) continue
        createNotification({
          orgId,
          userId: m.userId,
          type: 'application_status_changed',
          title: `Application moved to ${body.status}`,
          body: `Status changed from ${current.status} to ${body.status}`,
          resourceType: 'application',
          resourceId: id,
        }).catch(() => {})
      }
    }).catch(() => {})

    // Send candidate-facing email if the target stage has notifyCandidate enabled
    const targetStage = pipelineStages.find(s => s.id === body.status)
    if (targetStage?.notifyCandidate) {
      Promise.all([
        db.query.application.findFirst({
          where: eq(application.id, id),
          columns: { candidateId: true, jobId: true },
          with: {
            candidate: { columns: { email: true, firstName: true, lastName: true } },
            job: { columns: { title: true } },
          },
        }),
        db.query.organization.findFirst({
          where: eq(organization.id, orgId),
          columns: { name: true },
        }),
      ]).then(([appData, org]) => {
        if (appData?.candidate && appData?.job) {
          notifyCandidateStatusChange({
            candidateEmail: appData.candidate.email,
            candidateName: `${appData.candidate.firstName} ${appData.candidate.lastName}`,
            jobTitle: appData.job.title,
            orgName: org?.name ?? 'the hiring team',
            newStageLabel: targetStage.label,
          }).catch(() => {})
        }
      }).catch(() => {})
    }
  }

  return updated
})
