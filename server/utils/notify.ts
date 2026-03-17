import { notification } from '../database/schema'

interface CreateNotificationOpts {
  orgId: string
  userId: string
  type: string
  title: string
  body?: string
  resourceType?: string
  resourceId?: string
}

/**
 * Create an in-app notification for a specific user.
 * Inserts into the notification table. Novu integration (email/push)
 * can be wired here when configured.
 */
export async function createNotification(opts: CreateNotificationOpts) {
  const [row] = await db
    .insert(notification)
    .values({
      organizationId: opts.orgId,
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      resourceType: opts.resourceType ?? null,
      resourceId: opts.resourceId ?? null,
    })
    .returning({ id: notification.id })

  // Future: trigger Novu workflow for email/push delivery
  // if (novu) {
  //   await novu.trigger('in-app-notification', {
  //     to: { subscriberId: opts.userId },
  //     payload: { title: opts.title, body: opts.body },
  //   })
  // }

  return row
}
