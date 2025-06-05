#!/usr/bin/env node
import'dotenv/config.js'
import fetch from 'node-fetch'
import HandleHTTPResponse from '../lib/util/http-request-handler.cjs'

// Files
//import updatedCommunes from './../data/dataCog2025/cog-insee-2025-diff.json' assert { type: 'json' }
// import updatedCommunes from './../data/dataCog2025/cog-insee-2025-diff-renamed.json' with { type: 'json'}
// import updatedCommunes from './../data/dataCog2025/cog-insee-2025-diff-change-code-insee.json' assert { type: 'json' }
import updatedCommunes from '../dataset/dataCog2025/cog-insee-2025-diff.json' assert { type: 'json' }

//env Var
const BAN_API_URL = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'
const BAN_API_TOKEN = process.env.BAN_API_AUTHORIZED_TOKENS || ''
const defaultHeader = {
  Authorization: `Token ${BAN_API_TOKEN}`,
  'Content-Type': 'application/json',
}
const TEST_COG = process.env.TEST_COG === 'true' || false
const INSERT = process.env.INSERT === 'true' || false
const UPDATE = process.env.UPDATE === 'true' || false
const PATCH = process.env.PATCH === 'true' || false

async function main() {

  if (TEST_COG && INSERT) {
    // Insert des communes nouvelles
    try {
      const body = JSON.stringify(updatedCommunes.communesNouvelles)
      const response = await fetch(`${BAN_API_URL}/district/`, {
        method: 'POST',
        headers: defaultHeader,
        body,
      })
      const result = await HandleHTTPResponse(response)
      console.log(result)
    } catch (error) {
      const {message} = error
      throw new Error(`Ban API - ${message}`)
    }
  }

  if (TEST_COG && PATCH) {
    // Update de districts: renommages & ajout des attributs cog, mainCog & isMain dans les meta
    try {
      const body = JSON.stringify(updatedCommunes.communesModifiees)
      const response = await fetch(`${BAN_API_URL}/district/`, {
        method: 'PATCH',
        headers: defaultHeader,
        body,
      })
      const result = await HandleHTTPResponse(response)
      console.log(result)
    } catch (error) {
      const {message} = error
      throw new Error(`Ban API - ${message}`)
    }
  }

  process.exit(0)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
