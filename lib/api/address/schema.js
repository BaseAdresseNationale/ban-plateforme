import {object, string, number, boolean, array, date} from 'yup'
import {banID, geometrySchema, labelSchema, cadastreSchema} from '../schema.js'

const PositionTypes = ['entrance', 'building', 'staircase identifier', 'unit identifier', 'utility service', 'postal delivery', 'parcel', 'segment', 'other']

const positionSchema = object({
  type: string().trim().oneOf(PositionTypes).required(),
  geometry: geometrySchema.required(),
})

const metaSchema = object({
  cadastre: cadastreSchema
})

export const banAddressSchema = object({
  id: banID.required(),
  mainCommonToponymID: banID.required(),
  secondaryCommonToponymIDs: array().of(banID),
  districtID: banID.required(),
  number: number().positive().integer().required(),
  suffix: string().trim(),
  labels: array().of(labelSchema),
  certified: boolean(),
  positions: array().of(positionSchema).required(),
  updateDate: date().required(),
  meta: metaSchema
})

export const banAddressSchemaForPatch = object({
  id: banID.required(),
  mainCommonToponymID: banID,
  secondaryCommonToponymIDs: array().of(banID),
  districtID: banID,
  number: number().positive().integer(),
  suffix: string().trim(),
  labels: array().of(labelSchema).default(null).nullable(),
  certified: boolean().default(false),
  positions: array().of(positionSchema).default(null).nullable(),
  updateDate: date(),
  meta: metaSchema
})

export const addressDefaultOptionalValues = {
  secondaryCommonToponymIDs: [],
  suffix: '',
  labels: [],
  certified: false,
  meta: undefined,
}

