/**
 * Composable for uploading documents via Uppy + tus.
 *
 * Creates and manages an Uppy instance that uploads to /api/upload/
 * using the tus resumable protocol.
 *
 * @example
 * const { openPicker, isUploading, uploadProgress } = useUpload({
 *   candidateId: 'abc',
 *   applicationId: 'xyz', // optional
 *   onComplete: () => refresh(),
 * })
 */

import type { MaybeRefOrGetter } from 'vue'

export interface UseUploadOptions {
  candidateId: MaybeRefOrGetter<string | undefined>
  applicationId?: MaybeRefOrGetter<string | undefined>
  onComplete?: (documentId: string) => void
  onError?: (error: Error) => void
  /** Allowed doc type — defaults to 'resume' */
  defaultType?: string
}

export interface UploadFile {
  id: string
  name: string
  size: number
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
}

export function useUpload(opts: UseUploadOptions) {
  const files = ref<UploadFile[]>([])
  const isUploading = computed(() => files.value.some(f => f.status === 'uploading'))
  const uploadProgress = computed(() => {
    const uploading = files.value.filter(f => f.status === 'uploading')
    if (!uploading.length) return 0
    return Math.round(uploading.reduce((sum, f) => sum + f.progress, 0) / uploading.length)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let _uppy: any = null

  async function initUppy() {
    if (_uppy) return _uppy

    const { Uppy } = await import('@uppy/core')
    const { default: Tus } = await import('@uppy/tus')

    const candidateId = toValue(opts.candidateId)
    const applicationId = toValue(opts.applicationId)

    const uppy = new Uppy({
      id: `upload-${candidateId ?? 'unknown'}`,
      autoProceed: false,
      restrictions: {
        maxFileSize: 10 * 1024 * 1024, // 10 MB
        allowedFileTypes: ['.pdf', '.doc', '.docx'],
        maxNumberOfFiles: 10,
      },
    })

    uppy.use(Tus, {
      endpoint: '/api/upload/',
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: 5 * 1024 * 1024, // 5 MB chunks
      metadata: {
        candidateId: candidateId ?? '',
        applicationId: applicationId ?? '',
        type: opts.defaultType ?? 'resume',
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uppy.on('file-added', (file: any) => {
      files.value.push({
        id: file.id,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'pending',
      })
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uppy.on('upload-progress', (file: any, progress: any) => {
      const entry = files.value.find(f => f.id === file?.id)
      if (entry) {
        entry.progress = progress?.bytesTotal
          ? Math.round((progress.bytesUploaded / progress.bytesTotal) * 100)
          : 0
        entry.status = 'uploading'
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uppy.on('upload-success', (file: any, response: any) => {
      const entry = files.value.find(f => f.id === file?.id)
      if (entry) {
        entry.progress = 100
        entry.status = 'complete'
      }

      // The tus server injects the new document ID in a response header.
      // Uppy doesn't surface response headers directly, so we rely on onComplete
      // being called from the 'complete' event (which fires after all files finish).
      const documentId = (response?.uploadURL as string | undefined)?.split('/').pop() ?? ''
      opts.onComplete?.(documentId)
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uppy.on('upload-error', (file: any, error: any) => {
      const entry = files.value.find(f => f.id === file?.id)
      if (entry) {
        entry.status = 'error'
        entry.error = error?.message ?? 'Upload failed'
      }
      if (error instanceof Error) opts.onError?.(error)
      else opts.onError?.(new Error(error?.message ?? 'Upload failed'))
    })

    // Remove completed/errored files from the list after a short delay
    uppy.on('complete', () => {
      setTimeout(() => {
        files.value = files.value.filter(f => f.status !== 'complete' && f.status !== 'error')
      }, 3000)
    })

    _uppy = uppy
    return uppy
  }

  async function upload(fileList: File[], type?: string) {
    const uppy = await initUppy()

    // Update metadata type if provided
    const plugin = uppy.getPlugin('Tus')
    if (plugin && type) {
      plugin.setOptions({ metadata: { ...plugin.opts.metadata, type } })
    }

    for (const file of fileList) {
      try {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
        })
      }
      catch (err) {
        // File may already be added or exceed restrictions
        console.warn('[useUpload] Could not add file:', err)
      }
    }

    await uppy.upload()
  }

  function clearFiles() {
    files.value = []
    if (_uppy) {
      _uppy.cancelAll()
    }
  }

  onUnmounted(() => {
    if (_uppy) {
      _uppy.destroy()
      _uppy = null
    }
  })

  return {
    files,
    isUploading,
    uploadProgress,
    upload,
    clearFiles,
  }
}
