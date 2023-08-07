import {object, string, number, boolean, array, date} from 'yup'
import {banID, geometrySchema, cadastreSchema} from '../schema.js'

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
  certified: boolean(),
  positions: array().of(positionSchema),
  updateDate: date().required(),
  meta: metaSchema
})

