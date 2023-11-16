import {object, string, array, date, bool} from 'yup'
import {banID, labelSchema, balSchema} from '../schema.js'

const configSchema = object({
  useBanId: bool()
}).noUnknown()

const inseeSchema = object({
  cog: string().trim().length(5).when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
}).noUnknown()

const metaSchema = object({
  insee: inseeSchema,
  bal: balSchema,
}).noUnknown()

export const banDistrictSchema = object({
  id: banID.required(),
  labels: array().of(labelSchema).when('$isPatch', {
    is: true,
    // eslint-disable-next-line unicorn/no-thenable
    then: schema => schema.default(null).nullable(),
    otherwise: schema => schema.required(),
  }),
  updateDate: date().when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  config: configSchema,
  meta: metaSchema.when('$isPatch', {
    is: true,
    // eslint-disable-next-line unicorn/no-thenable
    then: schema => schema.default(null).nullable(),
  }),
}).noUnknown()

export const districtDefaultOptionalValues = {
  config: null,
}
