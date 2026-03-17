import { eq, and } from 'drizzle-orm'
import { candidate, candidateLink } from '../../../../database/schema'
import { candidateIdParamSchema } from '../../../../utils/schemas/candidate'
import { createCandidateLinkSchema } from '../../../../utils/schemas/candidate-link'

/**
 * POST /api/candidates/:id/links
 * Add an external profile link for a candidate.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { candidate: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id: candidateId } = await getValidatedRouterParams(event, candidateIdParamSchema.parse)
  const body = await readValidatedBody(event, createCandidateLinkSchema.parse)

  // Verify candidate belongs to this org
  const existing = await db.query.candidate.findFirst({
    where: and(eq(candidate.id, candidateId), eq(candidate.organizationId, orgId)),
    columns: { id: true },
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const [created] = await db.insert(candidateLink).values({
    organizationId: orgId,
    candidateId,
    type: body.type,
    url: body.url,
    label: body.label ?? null,
  }).returning({
    id: candidateLink.id,
    type: candidateLink.type,
    url: candidateLink.url,
    label: candidateLink.label,
    createdAt: candidateLink.createdAt,
  })

  setResponseStatus(event, 201)
  return created
})
