import { eq, and } from 'drizzle-orm'
import { candidateLink } from '../../../../database/schema'
import { candidateLinkIdParamSchema } from '../../../../utils/schemas/candidate-link'

/**
 * DELETE /api/candidates/:id/links/:linkId
 * Remove an external profile link from a candidate.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { candidate: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { linkId } = await getValidatedRouterParams(event, candidateLinkIdParamSchema.parse)

  const [deleted] = await db.delete(candidateLink)
    .where(and(
      eq(candidateLink.id, linkId),
      eq(candidateLink.organizationId, orgId),
    ))
    .returning({ id: candidateLink.id })

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  setResponseStatus(event, 204)
})
