import {object, string, number, array, date, boolean} from 'yup'

export const banID = string().trim().uuid()

export const labelSchema = object({
  isoCode: string().trim().length(3).required(),
  value: string().trim().required(),
})

export const geometrySchema = object({
  type: string().trim().matches(/^Point$/).required(),
  coordinates: array().length(2).of(number()).required(),
})

export const inseeSchema = object({
  cog: string().trim().length(5).required()
})

export const cadastreSchema = object({
  ids: array().of(string().trim())
})

export const balSchema = object({
  idRevision: string().trim(),
  dateRevision: date(),
  codeAncienneCommune: string().trim(),
  nomAncienneCommune: string().trim(),
  isLieuDit: boolean()
})

