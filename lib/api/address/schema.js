import {object, string, number, boolean, array, date} from 'yup'
import {banID, geometrySchema, labelSchema, cadastreSchema, balSchema, idfixSchema} from '../schema.js'

const PositionTypes = ['entrance', 'building', 'staircase identifier', 'unit identifier', 'utility service', 'postal delivery', 'parcel', 'segment', 'other']

const positionSchema = object({
  type: string().trim().oneOf(PositionTypes).required(),
  geometry: geometrySchema.required(),
}).noUnknown()

const metaSchema = object({
  cadastre: cadastreSchema,
  bal: balSchema,
  idfix: idfixSchema,
}).noUnknown()

export const banAddressSchema = object({
  id: banID.required(),
  mainCommonToponymID: banID.when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  secondaryCommonToponymIDs: array().of(banID),
  districtID: banID.when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  number: number().positive().integer().when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  suffix: string().trim(),
  labels: array().of(labelSchema).when('$isPatch', {
    is: true,
    // eslint-disable-next-line unicorn/no-thenable
    then: schema => schema.default(null).nullable(),
  }),
  certified: boolean(),
  positions: array().of(positionSchema).when('$isPatch', {
    is: true,
    // eslint-disable-next-line unicorn/no-thenable
    then: schema => schema.default(null).nullable(),
    otherwise: schema => schema.required(),
  }),
  updateDate: date().when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  meta: metaSchema
}).noUnknown()

export const addressDefaultOptionalValues = {
  secondaryCommonToponymIDs: [],
  suffix: null,
  labels: [],
  certified: false,
  meta: null,
}

