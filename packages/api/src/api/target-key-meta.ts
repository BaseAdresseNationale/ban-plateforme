import { z } from 'zod'

export const targetKeyBanMetaSchema = z.object({
  targetKeys: z.array(z.string().min(1).max(1024)).max(100).optional(),
})

export const interopMetaSchema = z.object({
  balProvidedKey: z.string().max(512).optional(),
  banComputedKey: z.string().min(1).max(512).optional(),
})

export const interopSelectionSchema = z.object({
  retainedKey: z.string().min(1).max(512),
})
