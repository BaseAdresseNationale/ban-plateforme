const process = require('process')
const fetch = require('./fetch.cjs')

const API_DEPOT_URL = process.env.API_DEPOT_URL || 'https://plateforme.adresse.data.gouv.fr/api-depot'

async function getCurrentRevision(codeCommune) {
  try {
    const response = await fetch(`${API_DEPOT_URL}/communes/${codeCommune}/current-revision`)
    return await response.json()
  } catch (error) {
    if (error.response?.status === 404) {
      return
    }

    throw error
  }
}

async function getRevisionFile(revisionId) {
  const response = await fetch(`${API_DEPOT_URL}/revisions/${revisionId}/files/bal/download`)
  return response.buffer()
}

async function getCurrentRevisons() {
  const response = await fetch(`${API_DEPOT_URL}/current-revisions`)
  return response.json()
}

module.exports = {getCurrentRevision, getRevisionFile, getCurrentRevisons}
