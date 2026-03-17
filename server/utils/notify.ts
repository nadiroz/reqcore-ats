import { notification } from '../database/schema'
import { getNovu } from '../lib/novu'

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
 * Create an in-app notification and optionally trigger Novu for
 * multi-channel delivery (email, push) when configured.
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

  const novu = getNovu()
  if (novu) {
    try {
      await novu.trigger({
        workflowId: 'in-app-notification',
        to: { subscriberId: opts.userId },
        payload: {
          title: opts.title,
          body: opts.body ?? '',
          type: opts.type,
          resourceType: opts.resourceType ?? '',
          resourceId: opts.resourceId ?? '',
        },
      })
    } catch (err) {
      console.error('[novu] Failed to trigger notification:', err)
    }
  }

  return row
}
