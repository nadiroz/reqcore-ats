import { eq, and } from 'drizzle-orm'
import { candidateLink } from '../../../../database/schema'
import { candidateIdParamSchema } from '../../../../utils/schemas/candidate'

/**
 * GET /api/candidates/:id/links
 * List all external profile links for a candidate.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { candidate: ['read'] })
  const orgId = session.session.activeOrganizationId

  const { id: candidateId } = await getValidatedRouterParams(event, candidateIdParamSchema.parse)

  const links = await db.query.candidateLink.findMany({
    where: and(
      eq(candidateLink.candidateId, candidateId),
      eq(candidateLink.organizationId, orgId),
    ),
    columns: { id: true, type: true, url: true, label: true, createdAt: true },
    orderBy: (l, { asc }) => [asc(l.createdAt)],
  })

  return links
})
