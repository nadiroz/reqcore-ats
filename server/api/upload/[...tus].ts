/**
 * Tus resumable upload endpoint.
 *
 * Handles all tus protocol requests (OPTIONS, POST, HEAD, PATCH, DELETE)
 * at /api/upload/*. Uses FileStore for in-progress uploads (OS temp dir),
 * then moves completed files to S3 and creates the document DB record.
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
 *   - MIME type validated from magic bytes on completion
 *   - Temp files cleaned up on S3 upload or DB insert failure
 */

import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { fileTypeFromBuffer } from 'file-type'
import { document } from '../../database/schema'
import { uploadToS3, deleteFromS3 } from '../../utils/s3'
import {
  ALLOWED_MIME_TYPES,
  MIME_TO_EXTENSION,
  documentTypeSchema,
  sanitizeFilename,
} from '../../utils/schemas/document'

// ─────────────────────────────────────────────
// Lazy tus server initialisation
// tus-node-server uses CJS — import lazily to avoid build-time crash
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _tusServer: any

const TUS_UPLOAD_DIR = path.join(os.tmpdir(), 'reqcore_tus_uploads')

function getTusServer() {
  if (_tusServer) return _tusServer

  // Dynamic require: avoids ESM/CJS interop issues at build time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Server, FileStore } = require('tus-node-server') as {
    Server: new (opts: Record<string, unknown>) => { handle: (req: unknown, res: unknown) => void }
    FileStore: new (opts: Record<string, unknown>) => unknown
  }

  _tusServer = new Server({
    path: '/api/upload',
    datastore: new FileStore({ directory: TUS_UPLOAD_DIR }),

    // ─────────────────────────────────────────────
    // Called after every tus chunk PATCH completes (final call = full file ready)
    // ─────────────────────────────────────────────
    onUploadFinish: async (req: Record<string, unknown>, res: Record<string, unknown>, upload: {
      id: string
      size: number
      offset: number
      metadata: Record<string, string>
    }) => {
      // Auth context injected by the defineEventHandler wrapper below
      const orgId = (req as Record<string, string>)._reqcoreOrgId
      const actorId = (req as Record<string, string>)._reqcoreActorId

      const meta = upload.metadata ?? {}
      const candidateId = meta.candidateId
      const applicationId = meta.applicationId ?? null
      const docType = meta.type ?? 'resume'
      const rawFilename = meta.filename ?? 'document'

      if (!orgId || !candidateId) {
        console.error('[tus] Missing orgId or candidateId in upload metadata')
        return res
      }

      // ─────────────────────────────────────────────
      // Read completed temp file
      // ─────────────────────────────────────────────
      const filePath = path.join(TUS_UPLOAD_DIR, upload.id)
      let fileBuffer: Buffer

      try {
        fileBuffer = await fs.readFile(filePath)
      }
      catch (err) {
        console.error('[tus] Failed to read completed upload file:', err)
        return res
      }

      // ─────────────────────────────────────────────
      // Validate MIME type from magic bytes
      // ─────────────────────────────────────────────
      const detectedType = await fileTypeFromBuffer(fileBuffer)
      let mimeType = detectedType?.mime

      // Detect legacy .doc (OLE2 compound document) manually
      if (!mimeType) {
        const OLE2_MAGIC = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
        if (fileBuffer.length >= 8 && Buffer.compare(fileBuffer.subarray(0, 8), OLE2_MAGIC) === 0) {
          mimeType = 'application/msword'
        }
      }

      if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number])) {
        await cleanup(filePath)
        console.error('[tus] Rejected upload — unsupported MIME type:', mimeType)
        return res
      }

      // ─────────────────────────────────────────────
      // Validate document type
      // ─────────────────────────────────────────────
      const typeResult = documentTypeSchema.safeParse(docType)
      if (!typeResult.success) {
        await cleanup(filePath)
        console.error('[tus] Invalid document type:', docType)
        return res
      }

      // ─────────────────────────────────────────────
      // Upload to S3 and create DB record
      // ─────────────────────────────────────────────
      const documentId = crypto.randomUUID()
      const extension = MIME_TO_EXTENSION[mimeType] ?? 'bin'
      const storageKey = `${orgId}/${candidateId}/${documentId}.${extension}`

      try {
        await uploadToS3(storageKey, fileBuffer, mimeType)
      }
      catch (err) {
        await cleanup(filePath)
        console.error('[tus] S3 upload failed:', err)
        return res
      }

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
          sizeBytes: fileBuffer.length,
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
        if (res && typeof (res as Record<string, unknown>).setHeader === 'function') {
          (res as { setHeader: (k: string, v: string) => void }).setHeader('Upload-Document-Id', documentId)
        }
      }
      catch (err) {
        await deleteFromS3(storageKey).catch(() => {})
        console.error('[tus] DB insert failed:', err)
      }
      finally {
        await cleanup(filePath)
      }

      return res
    },
  })

  return _tusServer
}

async function cleanup(filePath: string) {
  await fs.unlink(filePath).catch(() => {})
  await fs.unlink(`${filePath}.info`).catch(() => {})
}

// ─────────────────────────────────────────────
// Ensure upload temp directory exists
// ─────────────────────────────────────────────
try {
  await fs.mkdir(TUS_UPLOAD_DIR, { recursive: true })
}
catch {
  // Already exists
}

// ─────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────
export default defineEventHandler(async (event) => {
  // Validate auth before tus processes any request.
  // requirePermission throws 401/403, which is handled by H3 before tus runs.
  const session = await requirePermission(event, { document: ['create'] })

  // Inject org + actor context onto the Node.js request so the onUploadFinish
  // hook can access them without trusting client-supplied metadata.
  const req = event.node.req as Record<string, string>
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
