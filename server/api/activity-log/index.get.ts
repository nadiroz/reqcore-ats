import { eq, and, desc, inArray } from 'drizzle-orm'
import { activityLog, user, application } from '../../database/schema'
import { activityLogQuerySchema } from '../../utils/schemas/activityLog'

/**
 * GET /api/activity-log
 * List activity log entries for the current organization.
 * Requires activityLog:read permission.
 * Supports optional filters by resourceType, resourceId, and candidateId.
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { activityLog: ['read'] })
  const orgId = session.session.activeOrganizationId

  const query = await getValidatedQuery(event, activityLogQuerySchema.parse)
  const offset = (query.page - 1) * query.limit

  const conditions = [eq(activityLog.organizationId, orgId)]

  if (query.candidateId) {
    // Aggregate activity across all of a candidate's applications
    const appIds = await db
      .select({ id: application.id })
      .from(application)
      .where(and(eq(application.candidateId, query.candidateId), eq(application.organizationId, orgId)))
    const ids = appIds.map(a => a.id)
    if (ids.length) {
      conditions.push(eq(activityLog.resourceType, 'application'))
      conditions.push(inArray(activityLog.resourceId, ids))
    } else {
      // No applications, return empty
      return { data: [], total: 0, page: query.page, limit: query.limit }
    }
  } else {
    if (query.resourceType) {
      conditions.push(eq(activityLog.resourceType, query.resourceType))
    }
    if (query.resourceId) {
      conditions.push(eq(activityLog.resourceId, query.resourceId))
    }
  }

  const where = and(...conditions)

  const [data, total] = await Promise.all([
    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        resourceType: activityLog.resourceType,
        resourceId: activityLog.resourceId,
        metadata: activityLog.metadata,
        createdAt: activityLog.createdAt,
        actorId: activityLog.actorId,
        actorName: user.name,
        actorEmail: user.email,
        actorImage: user.image,
      })
      .from(activityLog)
      .innerJoin(user, eq(user.id, activityLog.actorId))
      .where(where)
      .orderBy(desc(activityLog.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.$count(activityLog, where),
  ])

  return { data, total, page: query.page, limit: query.limit }
})
