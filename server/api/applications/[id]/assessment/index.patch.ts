import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { application, applicationAssessment, member } from '../../../../database/schema'
import { applicationIdParamSchema } from '../../../../utils/schemas/application'
import { createNotification } from '../../../../utils/notify'
import type { AssessmentScores } from '~~/shared/assessment-types'

const taskScoreSchema = z.object({
  score: z.number().min(0).max(10),
  notes: z.string().max(2000).default(''),
})

const roundScoresSchema = z.object({
  tasks: z.array(taskScoreSchema),
})

const patchAssessmentSchema = z.object({
  scores: z.object({
    round1: roundScoresSchema.optional(),
    round2: roundScoresSchema.optional(),
  }).optional(),
  behavioralNotes: z.string().max(5000).nullable().optional(),
  decision: z.enum(['hire', 'no_hire', 'borderline', 'pending']).optional(),
  trainabilityNotes: z.string().max(2000).nullable().optional(),
  advanceToRound2: z.boolean().optional(),
  status: z.enum([
    'not_started', 'round1_sent', 'round1_submitted', 'round1_evaluated',
    'round2_sent', 'round2_submitted', 'completed',
  ]).optional(),
})

/**
 * PATCH /api/applications/:id/assessment
 * Update scores, behavioral notes, decision, or advance to round 2.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { application: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: applicationId } = await getValidatedRouterParams(event, applicationIdParamSchema.parse)
  const body = await readValidatedBody(event, patchAssessmentSchema.parse)

  const app = await db.query.application.findFirst({
    where: and(eq(application.id, applicationId), eq(application.organizationId, orgId)),
    columns: { id: true },
  })
  if (!app) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const existing = await db.query.applicationAssessment.findFirst({
    where: and(
      eq(applicationAssessment.applicationId, applicationId),
      eq(applicationAssessment.organizationId, orgId),
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'No assessment session found.' })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.scores !== undefined) {
    // Merge with existing scores
    const merged: AssessmentScores = {
      ...existing.scores,
      ...body.scores,
    }
    updates.scores = merged

    // Compute weighted overall score
    updates.overallScore = computeWeightedScore(merged)
  }

  if (body.behavioralNotes !== undefined) updates.behavioralNotes = body.behavioralNotes
  if (body.decision !== undefined) updates.decision = body.decision
  if (body.trainabilityNotes !== undefined) updates.trainabilityNotes = body.trainabilityNotes
  if (body.status !== undefined) updates.status = body.status

  if (body.advanceToRound2) {
    updates.currentRound = 2
    updates.status = 'round2_sent'
  }

  const [updated] = await db.update(applicationAssessment)
    .set(updates)
    .where(eq(applicationAssessment.id, existing.id))
    .returning()

  // Sync overall score to application.score (0-10 scale * 10 = 0-100)
  if (updates.overallScore !== undefined) {
    const scoreValue = Math.round((updates.overallScore as number) * 10)
    await db.update(application)
      .set({ score: scoreValue, updatedAt: new Date() })
      .where(eq(application.id, applicationId))
  }

  // Notify org members when a decision is made (fire-and-forget)
  if (body.decision && body.decision !== 'pending') {
    const decisionLabel = body.decision === 'hire' ? 'Hire' : body.decision === 'no_hire' ? 'No Hire' : 'Borderline'
    db.query.member.findMany({
      where: eq(member.organizationId, orgId),
      columns: { userId: true },
    }).then((members) => {
      for (const m of members) {
        if (m.userId === session.user.id) continue
        createNotification({
          orgId,
          userId: m.userId,
          type: 'assessment_decision',
          title: `Assessment decision: ${decisionLabel}`,
          body: `Assessment for application has been evaluated`,
          resourceType: 'application',
          resourceId: applicationId,
        }).catch(() => {})
      }
    }).catch(() => {})
  }

  // Notify when assessment is advanced to round 2
  if (body.advanceToRound2) {
    db.query.member.findMany({
      where: eq(member.organizationId, orgId),
      columns: { userId: true },
    }).then((members) => {
      for (const m of members) {
        if (m.userId === session.user.id) continue
        createNotification({
          orgId,
          userId: m.userId,
          type: 'assessment_advanced',
          title: 'Assessment advanced to Round 2',
          body: `Candidate has been advanced to assessment round 2`,
          resourceType: 'application',
          resourceId: applicationId,
        }).catch(() => {})
      }
    }).catch(() => {})
  }

  return updated
})

/**
 * Compute a weighted average score across all scored rounds.
 * Returns a value from 0-10.
 */
function computeWeightedScore(scores: AssessmentScores): number {
  let totalWeight = 0
  let weightedSum = 0

  for (const round of [scores.round1, scores.round2]) {
    if (!round?.tasks) continue
    for (const task of round.tasks) {
      if (task.score > 0) {
        // Weight is assumed to be in the template; here we treat all tasks equally
        // since we don't have template context. The UI should pass normalized weights.
        totalWeight += 1
        weightedSum += task.score
      }
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}
