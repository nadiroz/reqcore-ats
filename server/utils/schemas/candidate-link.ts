import { z } from 'zod'

export const VALID_LINK_TYPES = ['github', 'linkedin', 'portfolio', 'website', 'other'] as const
export type LinkType = typeof VALID_LINK_TYPES[number]

export const createCandidateLinkSchema = z.object({
  type: z.enum(VALID_LINK_TYPES).default('other'),
  url: z.string().url('Invalid URL').max(2048),
  label: z.string().max(100).optional(),
})

export const candidateLinkIdParamSchema = z.object({
  id: z.string().min(1),
  linkId: z.string().min(1),
})
