import { eq } from 'drizzle-orm'
import { orgSettings } from '../../database/schema'
import { DEFAULT_PIPELINE_STAGES } from '~~/shared/status-transitions'

/**
 * GET /api/pipeline-config
 * Returns the org's pipeline config, falling back to defaults if none is set.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { job: ['read'] })
  const orgId = session.session.activeOrganizationId

  const settings = await db.query.orgSettings.findFirst({
    where: eq(orgSettings.organizationId, orgId),
    columns: { pipelineConfig: true },
  })

  const stages = settings?.pipelineConfig?.stages ?? DEFAULT_PIPELINE_STAGES
  const transitionRules = settings?.pipelineConfig?.transitionRules ?? []

  return { stages, transitionRules }
})
