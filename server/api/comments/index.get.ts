import { eq, and, desc, inArray, or } from 'drizzle-orm'
import { comment, user, application } from '../../database/schema'
import { commentQuerySchema } from '../../utils/schemas/comment'

/**
 * GET /api/comments
 * List comments for a specific target (candidate, application, or job).
 * Supports candidateId filter to aggregate comments across all of a candidate's applications.
 * Requires comment:read permission.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { comment: ['read'] })
  const orgId = session.session.activeOrganizationId

  const query = await getValidatedQuery(event, commentQuerySchema.parse)
  const offset = (query.page - 1) * query.limit

  let where
  if ('candidateId' in query && query.candidateId) {
    // Aggregate: all comments on this candidate + all their applications
    const appIds = await db
      .select({ id: application.id })
      .from(application)
      .where(and(eq(application.candidateId, query.candidateId), eq(application.organizationId, orgId)))

    const ids = appIds.map(a => a.id)

    where = and(
      eq(comment.organizationId, orgId),
      or(
        and(eq(comment.targetType, 'candidate'), eq(comment.targetId, query.candidateId)),
        ...(ids.length ? [and(eq(comment.targetType, 'application'), inArray(comment.targetId, ids))] : []),
      ),
    )
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = query as any
    where = and(
      eq(comment.organizationId, orgId),
      eq(comment.targetType, q.targetType as 'job' | 'candidate' | 'application'),
      eq(comment.targetId, q.targetId as string),
    )
  }

  const [data, total] = await Promise.all([
    db
      .select({
        id: comment.id,
        targetType: comment.targetType,
        targetId: comment.targetId,
        body: comment.body,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        authorId: comment.authorId,
        authorName: user.name,
        authorEmail: user.email,
        authorImage: user.image,
      })
      .from(comment)
      .innerJoin(user, eq(user.id, comment.authorId))
      .where(where)
      .orderBy(desc(comment.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.$count(comment, where),
  ])

  return { data, total, page: query.page, limit: query.limit }
})
