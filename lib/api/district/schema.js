import {object, string, array, date, boolean} from 'yup'
import {banID, labelSchema, balSchema} from '../schema.js'

/** Plafonds texte PDF certificat — à garder cohérents avec le front. */
const MAX_CERTIFICATE_ISSUER_DETAILS = 4000
const MAX_CERTIFICATE_ATTESTATION_TEXT = 20_000

const CertificationTypeEnum = [
  'DISTRICT',
  'ALL',
  'DISABLED'
]

const certificateSchema = string().oneOf(CertificationTypeEnum)

/** En patch : booléens optionnels + `null` pour retirer la clé (retour aux défauts applicatifs). */
const patchOptionalBooleanWithNull = () =>
  boolean().when('$isPatch', {
    is: true,
    // eslint-disable-next-line unicorn/no-thenable
    then: schema => schema.optional().nullable(),
    otherwise: schema => schema.optional(),
  })

// Schéma config : en patch tous les champs sont optionnels, defaultBalLang peut être null (suppression)
export const configSchema = object({
  certificate: certificateSchema.when('$isPatch', {
    is: true,
    // eslint-disable-next-line unicorn/no-thenable
    then: schema => schema.optional().nullable(),
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
  certificateShowLogo: patchOptionalBooleanWithNull(),
  certificateIssuerDetails: string()
    .trim()
    .max(MAX_CERTIFICATE_ISSUER_DETAILS, 'The certificateIssuerDetails field is too long.')
    .when('$isPatch', {
      is: true,
      // eslint-disable-next-line unicorn/no-thenable
      then: schema => schema.optional().nullable(),
      otherwise: schema => schema.optional(),
    }),
  certificateAttestationText: string()
    .trim()
    .max(MAX_CERTIFICATE_ATTESTATION_TEXT, 'The certificateAttestationText field is too long.')
    .when('$isPatch', {
      is: true,
      // eslint-disable-next-line unicorn/no-thenable
      then: schema => schema.optional().nullable(),
      otherwise: schema => schema.optional(),
    }),
}).noUnknown()

export const parseConfigPatch = partial =>
  configSchema.validate(partial, {
    strict: true,
    abortEarly: false,
    context: {isPatch: true},
  })

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
  meta: metaSchema.when('$isPatch', {
    is: true,
    // eslint-disable-next-line unicorn/no-thenable
    then: schema => schema.default(null).nullable(),
  }),
}).noUnknown()

export const districtDefaultOptionalValues = {}
