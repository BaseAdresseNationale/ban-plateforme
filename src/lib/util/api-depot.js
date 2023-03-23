const process = require('process')
const got = require('got')

const API_DEPOT_URL = process.env.API_DEPOT_URL || 'https://plateforme.adresse.data.gouv.fr/api-depot'

async function getCurrentRevision(codeCommune) {
  try {
    return await got(`${API_DEPOT_URL}/communes/${codeCommune}/current-revision`).json()
  } catch (error) {
    if (error.response?.statusCode === 404) {
      return
    }

    throw error
  }
}

async function getRevisionFile(revisionId) {
  return got(`${API_DEPOT_URL}/revisions/${revisionId}/files/bal/download`).buffer()
}

module.exports = {getCurrentRevision, getRevisionFile}
