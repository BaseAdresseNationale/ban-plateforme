import {object, string, array, number} from 'yup'

export const banCommonToponymID = string().trim().uuid()

const labelSchema = object({
  isoCode: string().trim().required(),
  value: string().trim().required(),
})

const typeValues = ['voie', 'lieu-dit', 'autre']

const typeSchema = object({
  label: string().trim(),
  value: string().trim().oneOf(typeValues).required(),
})

const geometrySchema = object({
  type: string().trim().matches(/^Point$/).required(),
  coordinates: array().length(2).of(number()).required(),
})

export const banCommonToponymSchema = object({
  id: banCommonToponymID.required(),
  districtID: string().trim().required(),
  label: array().of(labelSchema).required(),
  type: typeSchema.required(),
  parcels: array().of(string().trim()),
  geometry: geometrySchema.required(),
  updateDate: string().trim().required(),
})
