import {object, string, number, array, boolean} from 'yup'

export const banID = string().trim().uuid()

export const labelSchema = object({
  isoCode: string().trim().length(3).required(),
  value: string().trim().required(),
}).noUnknown()

export const geometrySchema = object({
  type: string().trim().matches(/^Point$/).required(),
  coordinates: array().length(2).of(number()).required(),
}).noUnknown()

export const cadastreSchema = object({
  ids: array().of(string().trim())
}).noUnknown()

export const balSchema = object({
  idRevision: string().trim(),
  dateRevision: string().trim(),
  codeAncienneCommune: string().trim(),
  nomAncienneCommune: string().trim(),
  isLieuDit: boolean(),
  cleInterop: string().trim(),
  deprecatedID: string().trim(),
}).noUnknown()

export const idfixSchema = object({
  hash: string().trim(),
}).noUnknown()
