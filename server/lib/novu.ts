import { Novu } from '@novu/api'

let novuClient: Novu | null = null

/**
 * Lazy-initialized Novu v3 client for multi-channel notification delivery.
 * Returns null when NOVU_API_KEY is not configured (notifications stay in-app only).
 */
export function getNovu(): Novu | null {
  if (novuClient) return novuClient

  const secretKey = process.env.NOVU_API_KEY
  if (!secretKey) return null

  const serverURL = process.env.NOVU_API_URL
  novuClient = new Novu({ secretKey, serverURL })
  console.info('[novu] Client initialized', serverURL ? `(${serverURL})` : '')
  return novuClient
}
