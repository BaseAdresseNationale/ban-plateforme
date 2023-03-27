import {object, string, number} from 'yup'

export const banAddressSchema = object({
  id: string().trim().uuid().required(),
  codeCommune: string().trim().required(),
  voieLabel: string().trim().required(),
  numero: number().required().positive().integer(),
  suffixe: string().trim(),
})
