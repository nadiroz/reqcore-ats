import { eq, and } from 'drizzle-orm'
import { comment, candidate, application, job, member } from '../../database/schema'
import { createCommentSchema } from '../../utils/schemas/comment'
import { createNotification } from '../../utils/notify'

/**
 * POST /api/comments
 * Create a comment on a candidate, application, or job.
 * Requires comment:create permission.
 * The target must belong to the same organization (prevents IDOR).
 */
export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { comment: ['create'] })
  const orgId = session.session.activeOrganizationId

  const body = await readValidatedBody(event, createCommentSchema.parse)

  // ── Verify the target belongs to this org ──
  let targetExists: { id: string } | undefined

  if (body.targetType === 'candidate') {
    targetExists = await db.query.candidate.findFirst({
      where: and(eq(candidate.id, body.targetId), eq(candidate.organizationId, orgId)),
      columns: { id: true },
    })
  } else if (body.targetType === 'application') {
    targetExists = await db.query.application.findFirst({
      where: and(eq(application.id, body.targetId), eq(application.organizationId, orgId)),
      columns: { id: true },
    })
  } else {
    targetExists = await db.query.job.findFirst({
      where: and(eq(job.id, body.targetId), eq(job.organizationId, orgId)),
      columns: { id: true },
    })
  }

  if (!targetExists) {
    throw createError({
      statusCode: 404,
      statusMessage: `${body.targetType} not found`,
    })
  }

  // If replying, validate parent exists and shares the same target
  if (body.parentId) {
    const parent = await db.query.comment.findFirst({
      where: and(eq(comment.id, body.parentId), eq(comment.organizationId, orgId)),
      columns: { id: true, targetType: true, targetId: true, parentId: true },
    })
    if (!parent) {
      throw createError({ statusCode: 404, statusMessage: 'Parent comment not found' })
    }
    if (parent.targetType !== body.targetType || parent.targetId !== body.targetId) {
      throw createError({ statusCode: 400, statusMessage: 'Reply must target the same entity as the parent comment' })
    }
    // Only allow one level of nesting
    if (parent.parentId) {
      throw createError({ statusCode: 400, statusMessage: 'Nested replies are not supported' })
    }
  }

  const [created] = await db.insert(comment).values({
    organizationId: orgId,
    authorId: session.user.id,
    targetType: body.targetType,
    targetId: body.targetId,
    body: body.body,
    parentId: body.parentId ?? null,
  }).returning({
    id: comment.id,
    targetType: comment.targetType,
    targetId: comment.targetId,
    body: comment.body,
    parentId: comment.parentId,
    authorId: comment.authorId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  })

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create comment' })
  }

  // Record activity (fire-and-forget)
  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'comment_added',
    resourceType: body.targetType,
    resourceId: body.targetId,
    metadata: { commentId: created.id },
  })

  // Parse @mentions from comment body: @[Name](userId) format
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
  const mentionedUserIds = new Set<string>()
  let mentionMatch
  while ((mentionMatch = mentionRegex.exec(body.body)) !== null) {
    mentionedUserIds.add(mentionMatch[2])
  }

  // Strip mention markup for notification preview
  const plainBody = body.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
  const preview = plainBody.length > 100 ? plainBody.slice(0, 100) + '...' : plainBody

  // Notify mentioned users first (targeted notification)
  for (const userId of mentionedUserIds) {
    if (userId === session.user.id) continue
    createNotification({
      orgId,
      userId,
      type: 'comment_added',
      title: `${session.user.name ?? 'Someone'} mentioned you in a comment`,
      body: preview,
      resourceType: body.targetType,
      resourceId: body.targetId,
    }).catch(() => {})
  }

  // Notify remaining org members (fire-and-forget)
  db.query.member.findMany({
    where: eq(member.organizationId, orgId),
    columns: { userId: true },
  }).then((members) => {
    for (const m of members) {
      if (m.userId === session.user.id) continue
      if (mentionedUserIds.has(m.userId)) continue
      createNotification({
        orgId,
        userId: m.userId,
        type: 'comment_added',
        title: `New comment on ${body.targetType}`,
        body: preview,
        resourceType: body.targetType,
        resourceId: body.targetId,
      }).catch(() => {})
    }
  }).catch(() => {})

  setResponseStatus(event, 201)
  return created
})
