/**
 * Novu client for multi-channel notification delivery.
 * Optional: when NOVU_API_KEY is not set, notifications are limited to in-app only.
 * Novu adds email (via Resend), push, and SMS channels on top of the notification table.
 *
 * To enable:
 * 1. Add Novu services to docker-compose.yml (see docs)
 * 2. Set NOVU_API_KEY in .env
 * 3. Uncomment the Novu trigger in server/utils/notify.ts
 */

let novuClient: any = null

export function getNovu() {
  if (novuClient) return novuClient

  const apiKey = process.env.NOVU_API_KEY
  if (!apiKey) return null

  try {
    // Dynamic import to avoid hard dependency when not configured
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Novu } = require('@novu/node')
    novuClient = new Novu(apiKey)
    console.info('[novu] Client initialized')
    return novuClient
  } catch {
    console.info('[novu] @novu/node not installed, skipping')
    return null
  }
}
