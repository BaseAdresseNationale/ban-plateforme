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

export const banAddressSchema = object({
  id: string().trim().uuid().required(),
  codeCommune: string().trim().required(),
  idVoie: string().trim().required(),
  numero: number().positive().integer().required(),
  suffixe: string().trim(),
  parcelles: array().of(string().trim()),
  certifie: boolean(),
  positions: array().of(positionSchema),
  dateMAJ: string().trim().required(),
})

