import {object, string, array, date, boolean} from 'yup'
import {banID, labelSchema, balSchema} from '../schema.js'

const CertificationTypeEnum = [
  'DISTRICT',
  'ALL',
  'DISABLED'
]

const certificateSchema = string().oneOf(CertificationTypeEnum)

// Schéma config : en patch tous les champs sont optionnels, defaultBalLang peut être null (suppression)
const configSchema = object({
  certificate: certificateSchema.when('$isPatch', {
    is: true,
    // eslint-disable-next-line unicorn/no-thenable
    then: schema => schema.optional(),
    otherwise: schema => schema.required(),
  }),
  defaultBalLang: string()
    .trim()
    .length(3, 'The defaultBalLang field must be exactly 3 characters long.')
    .when('$isPatch', {
      is: true,
      // eslint-disable-next-line unicorn/no-thenable
      then: schema => schema.optional().nullable(),
      otherwise: schema => schema.required(),
    }),
  autoFixLabels: boolean().optional(),
  computOldDistrict: boolean().optional(),
  computInteropKey: boolean().optional(),
  mandatary: string().optional(),
}).noUnknown()

const inseeSchema = object({
  cog: string().trim().length(5).when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  mainCog: string().trim().length(5).when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  isMain: boolean().when('$isPatch', {
    is: true,
    otherwise: schema => schema.required(),
  }),
  mainId: banID.when('$isPatch', {
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
    // eslint-disable-next-line unicorn/no-thenable
    then: schema => schema.optional().nullable(),
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
