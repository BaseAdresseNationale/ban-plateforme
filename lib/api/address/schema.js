import {object, string, number, boolean, array} from 'yup'

const geometrySchema = object({
  type: string().trim().matches(/^Point$/).required(),
  coordinates: array().length(2).of(number()).required(),
})

const PositionTypes = ['entrée', 'bâtiment', 'cage d\'escalier', 'logement', 'service technique', 'délivrance postale', 'parcelle', 'segment', 'autre']

const positionSchema = object({
  type: string().trim().oneOf(PositionTypes).required(),
  geometry: geometrySchema.required(),
})

export const banID = string().trim().uuid()

export const banAddressSchema = object({
  id: banID.required(),
  districtID: string().trim().required(),
  commonToponymID: string().trim().required(),
  number: number().positive().integer().required(),
  suffix: string().trim(),
  parcels: array().of(string().trim()),
  certified: boolean(),
  positions: array().of(positionSchema),
  updateDate: string().trim().required(),
})

