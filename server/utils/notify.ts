import { eq } from 'drizzle-orm'
import { notification, orgSettings } from '../database/schema'
import type { NotificationPreferences } from '../database/schema'
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

interface CandidateStatusEmailOpts {
  candidateEmail: string
  candidateName: string
  jobTitle: string
  orgName: string
  newStageLabel: string
}

/**
 * Fetch org notification preferences (cached per request cycle).
 * Returns null if no preferences are set (all channels default to enabled).
 */
async function getOrgNotificationPrefs(orgId: string): Promise<NotificationPreferences | null> {
  try {
    const settings = await db.query.orgSettings.findFirst({
      where: eq(orgSettings.organizationId, orgId),
      columns: { notificationPreferences: true },
    })
    return settings?.notificationPreferences ?? null
  } catch {
    return null
  }
}

/**
 * Create an in-app notification and optionally trigger Novu for
 * multi-channel delivery (email, push) when configured.
 * Respects org-level notification preferences per type.
 */
export async function createNotification(opts: CreateNotificationOpts) {
  const prefs = await getOrgNotificationPrefs(opts.orgId)
  const typePrefs = prefs?.[opts.type as keyof NotificationPreferences]

  // If inApp is explicitly disabled for this type, skip DB insert
  if (typePrefs?.inApp === false) return null

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

/**
 * Send a status update email to a candidate via Novu.
 * Only fires when Novu is configured and the pipeline stage has notifyCandidate enabled.
 * Uses a dedicated 'candidate-status-update' workflow for email delivery.
 */
export async function notifyCandidateStatusChange(opts: CandidateStatusEmailOpts) {
  const novu = getNovu()
  if (!novu) return

  try {
    await novu.trigger({
      workflowId: 'candidate-status-update',
      to: { subscriberId: `candidate-${opts.candidateEmail}`, email: opts.candidateEmail },
      payload: {
        candidateName: opts.candidateName,
        jobTitle: opts.jobTitle,
        orgName: opts.orgName,
        stageLabel: opts.newStageLabel,
      },
    })
  } catch (err) {
    console.error('[novu] Failed to send candidate status email:', err)
  }
}
