const {object, string, number} = require('yup')

const banAddressSchema = object({
  id: string().trim().uuid().required(),
  codeCommune: string().trim().required(),
  voieLabel: string().trim().required(),
  numero: number().required().positive().integer(),
  suffixe: string().trim(),
})

module.exports = {banAddressSchema}
