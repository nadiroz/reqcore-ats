import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { orgSettings } from '../../database/schema'
import { DEFAULT_PIPELINE_STAGES } from '~~/shared/status-transitions'

const pipelineStageSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(64),
  terminal: z.boolean(),
  builtin: z.boolean(),
  gate: z.boolean().optional(),
  notifyCandidate: z.boolean().optional(),
})

const transitionRuleSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  requiresApproval: z.boolean(),
})

const patchBodySchema = z.object({
  stages: z.array(pipelineStageSchema).min(2),
  transitionRules: z.array(transitionRuleSchema).optional(),
})

/**
 * PATCH /api/pipeline-config
 * Update the org's pipeline stage configuration.
 * Validates that all builtin terminal stages (hired, rejected) are preserved.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { organization: ['update'] })
  const orgId = session.session.activeOrganizationId

  const body = await readValidatedBody(event, patchBodySchema.parse)

  // Ensure built-in terminal stages are present
  const requiredBuiltins = ['hired', 'rejected']
  for (const id of requiredBuiltins) {
    if (!body.stages.find(s => s.id === id)) {
      throw createError({
        statusCode: 422,
        statusMessage: `Stage "${id}" is required and cannot be removed.`,
      })
    }
  }

  // Ensure at least one non-terminal stage exists
  if (!body.stages.some(s => !s.terminal)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'At least one active (non-terminal) stage is required.',
    })
  }

  const config = {
    stages: body.stages,
    transitionRules: body.transitionRules ?? [],
  }

  await db.insert(orgSettings)
    .values({
      organizationId: orgId,
      pipelineConfig: config,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: orgSettings.organizationId,
      set: { pipelineConfig: config, updatedAt: new Date() },
    })

  return config
})
