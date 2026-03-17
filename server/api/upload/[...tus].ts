/**
 * Tus resumable upload endpoint.
 *
 * Handles all tus protocol requests (OPTIONS, POST, HEAD, PATCH, DELETE)
 * at /api/upload/*. Uses S3Store for direct S3/MinIO uploads without
 * temp files, then creates the document DB record on completion.
 *
 * Client sends these tus metadata fields:
 *   - candidateId  (required)
 *   - filename     (required)
 *   - type         (required: resume | cover_letter | portfolio | reference | certificate | other)
 *   - applicationId (optional: scopes document to a specific application)
 *
 * Security:
 *   - Auth required for all requests (requirePermission runs before tus)
 *   - orgId + actorId are injected server-side (never trusted from client metadata)
 *   - MIME type validated from file extension and Content-Type header on completion
 */

import { Server } from '@tus/server'
import { S3Store } from '@tus/s3-store'
import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { document } from '../../database/schema'
import { getS3Client } from '../../utils/s3'
import {
  ALLOWED_MIME_TYPES,
  MIME_TO_EXTENSION,
  documentTypeSchema,
  sanitizeFilename,
} from '../../utils/schemas/document'

// ─────────────────────────────────────────────
// Lazy tus server initialisation
// ─────────────────────────────────────────────

let _tusServer: Server | null = null

function getTusServer() {
  if (_tusServer) return _tusServer

  _tusServer = new Server({
    path: '/api/upload',
    datastore: new S3Store({
      s3ClientConfig: {
        bucket: env.S3_BUCKET,
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY,
          secretAccessKey: env.S3_SECRET_KEY,
        },
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
      },
    }),

    // ─────────────────────────────────────────────
    // Called after the final tus chunk completes (full file ready in S3)
    // @tus/server v2: (req, upload) — no res argument
    // ─────────────────────────────────────────────
    onUploadFinish: async (req, upload) => {
      // Auth context injected by the defineEventHandler wrapper below
      const orgId = (req as unknown as Record<string, string>)._reqcoreOrgId
      const actorId = (req as unknown as Record<string, string>)._reqcoreActorId

      const meta = upload.metadata ?? {}
      const candidateId = meta.candidateId
      const applicationId = meta.applicationId ?? null
      const docType = meta.type ?? 'resume'
      const rawFilename = meta.filename ?? 'document'

      if (!orgId || !candidateId) {
        console.error('[tus] Missing orgId or candidateId in upload metadata')
        return {}
      }

      // ─────────────────────────────────────────────
      // Validate document type
      // ─────────────────────────────────────────────
      const typeResult = documentTypeSchema.safeParse(docType)
      if (!typeResult.success) {
        console.error('[tus] Invalid document type:', docType)
        return { status_code: 422, body: 'Invalid document type' }
      }

      // ─────────────────────────────────────────────
      // Determine MIME type from client Content-Type header or filename
      // ─────────────────────────────────────────────
      const clientContentType = meta['content-type'] ?? meta.contentType ?? ''

      const MIME_WHITELIST: Record<string, string> = {
        'application/pdf': 'application/pdf',
        'application/msword': 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }

      let mimeType: string | undefined = MIME_WHITELIST[clientContentType]

      // Fall back to extension-based detection
      if (!mimeType) {
        const ext = rawFilename.split('.').pop()?.toLowerCase()
        const EXT_MAP: Record<string, string> = {
          pdf: 'application/pdf',
          doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
        mimeType = ext ? EXT_MAP[ext] : undefined
      }

      if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number])) {
        console.error('[tus] Rejected upload — unsupported MIME type:', mimeType, 'for file:', rawFilename)
        return { status_code: 415, body: 'Unsupported file type' }
      }

      // ─────────────────────────────────────────────
      // Copy tus temp key to canonical org/candidate/docId key
      // S3Store saves the file at upload.id in the configured bucket
      // ─────────────────────────────────────────────
      const documentId = crypto.randomUUID()
      const extension = MIME_TO_EXTENSION[mimeType] ?? 'bin'
      const storageKey = `${orgId}/${candidateId}/${documentId}.${extension}`
      const s3 = getS3Client()

      try {
        await s3.send(new CopyObjectCommand({
          Bucket: env.S3_BUCKET,
          CopySource: `${env.S3_BUCKET}/${upload.id}`,
          Key: storageKey,
          ContentType: mimeType,
        }))
      }
      catch (err) {
        console.error('[tus] S3 copy to canonical key failed:', err)
        return { status_code: 500, body: 'Upload storage failed' }
      }

      // Clean up tus temp key and its .info metadata (best-effort)
      s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: upload.id })).catch(() => {})
      s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: `${upload.id}.info` })).catch(() => {})

      // ─────────────────────────────────────────────
      // Create DB record
      // ─────────────────────────────────────────────
      try {
        const [created] = await db.insert(document).values({
          id: documentId,
          organizationId: orgId,
          candidateId,
          applicationId: applicationId || null,
          type: typeResult.data,
          storageKey,
          originalFilename: sanitizeFilename(rawFilename),
          mimeType,
          sizeBytes: upload.size ?? 0,
        }).returning({
          id: document.id,
          type: document.type,
          originalFilename: document.originalFilename,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          createdAt: document.createdAt,
        })

        if (created && actorId) {
          recordActivity({
            organizationId: orgId,
            actorId,
            action: 'created',
            resourceType: 'document',
            resourceId: created.id,
            metadata: { candidateId, filename: created.originalFilename, type: created.type },
          })
        }

        // Surface the new document ID in a response header so the client
        // can refresh its document list without a full refetch
        return {
          headers: { 'Upload-Document-Id': documentId },
        }
      }
      catch (err) {
        console.error('[tus] DB insert failed:', err)
        return {}
      }
    },
  })

  return _tusServer
}

// ─────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────
export default defineEventHandler(async (event) => {
  // Validate auth before tus processes any request.
  // requirePermission throws 401/403, handled by H3 before tus runs.
  const session = await requirePermission(event, { document: ['create'] })

  // Inject org + actor context onto the Node.js request so the onUploadFinish
  // hook can access them without trusting client-supplied metadata.
  const req = event.node.req as unknown as Record<string, string>
  req._reqcoreOrgId = session.session.activeOrganizationId
  req._reqcoreActorId = session.user.id

  const tusServer = getTusServer()

  // Tell H3 we are writing the response ourselves
  event.handled = true

  return new Promise<void>((resolve, reject) => {
    tusServer.handle(event.node.req, event.node.res)
    event.node.res.on('finish', resolve)
    event.node.res.on('error', reject)
  })
})
