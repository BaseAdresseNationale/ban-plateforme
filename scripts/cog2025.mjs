#!/usr/bin/env node
import'dotenv/config.js'
import path from 'path'
import fetch from 'node-fetch'
import fs from 'fs-extra'
import HandleHTTPResponse from '../lib/util/http-request-handler.cjs'
import {formatDistrict} from '../lib/api/district/utils.js'
import {getDistrictsFromCog} from '../lib/api/district/models.js'

// Files
import updatedCommunes from './../data/updated-communes.json' with {type: 'json'}
import fixIdNewCommunes from './../data/dataCog2025/fixed-ids-new-district.json' with {type: 'json'}
import data from './../data/dataCog2025/cog-insee-2025.json' with {type: 'json'}
import { log } from 'console'

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
  // Chargement du JSON des communes
  // const filePath = path.join(__dirname, '..', 'data', 'updated-communes.json')
  // const fileData = JSON.parse(await fs.readFile(filePath))

  // const filePath2 = path.join(__dirname, '..', 'data', 'accepted-cog-list.json')
  // const whiteList = JSON.parse(await fs.readFile(filePath2))

  const cAnciennes = updatedCommunes.communesAnciennes // Données extraites du COG 2025
  const cNouvelles = updatedCommunes.communesNouvelles // Données extraites du COG 2025
  // const cRenamed = fileData.renamedCommunes
  // console.log(cAnciennes)

  // const cAnciennesWhiteList = cAnciennes.map(commune => commune.meta.insee.cog).filter(commune => whiteList.includes(commune))
  // console.log(cAnciennesWhiteList)
  //
  // Méthode de fabrication des données dans le fichier `updatedCommunes.js`
  //
  // const cog2025JSON = path.join(__dirname, '..', 'data', 'dataCog2025', 'cog-insee-2025.json')
  // const cog2025 = JSON.parse(await fs.readFile(cog2025JSON))

  const dataCog = data.dataCog2025.filter(value=> value.MOD === "32") // données extraites du COG 2025 :32 === Création nouvelle commune
  const ids = fixIdNewCommunes
  const communesNouvelles = [] // Communes nouvelles à créer
  const communesAnciennes = [] // Commmunes anciennes à updater
  var counter = 0 // Pour le parcours du fichier des Ids des nouvelles communes
  var i = 0 // Pour le parcours des différentes communes: nouvelles & anciennes

  // Récupération des informations des communes anciennes 
  const promiseCA = dataCog.map((districtMouvement)=> getDistrictsFromCog(districtMouvement.COM_AV))
  const CAFromCogPromises = await Promise.all(promiseCA)

  // Récupération des informations des communes nouvelles
  // const promiseCN = dataCog.map((districtMouvement)=> getDistrictsFromCog(districtMouvement.))
  // const CNFromCogPromises = await Promise.all(promiseDistricts)

  for (const districtMouvement of dataCog){

      // Récupération des données d'un mouvement sur les communes
      const district = await getDistrictsFromCog(districtMouvement.COM_AV)
      // Formattage
      const formatterdDistrict = formatDistrict(district[0])

      // Valeur de la commune nouvelle
      const idCN = ids[counter]
      var isNew = false
      const codeComN = {"nom": districtMouvement["NomCN"], "cog": districtMouvement["DepComN"], "date": districtMouvement.DATE_EFF, "id": ""}

      // Meta de l'ancienne commune
      const oldMeta = formatterdDistrict["meta"]["insee"]
      // Commune Nouvelle rencontrée
      if(!(communesNouvelles.some((item) => item.meta.insee.cog == codeComN.cog))){
          isNew = true
          counter = counter + 1
          codeComN["id"] = idCN

          const newDistrict = {
            "id": codeComN.id,
            "labels": [{"value": codeComN.nom, "isoCode": 'fra'}],
            "meta": {
              "insee":{
                "cog": codeComN.cog,
                "mainCog": codeComN.cog,
                "isMain": true,
                "mainId": codeComN.id
              }
            },
            "updateDate": new Date(codeComN.date)
          }
          // Ajout à la liste des objets à traiter
          communesNouvelles.push(newDistrict)
      }

      formatterdDistrict["meta"]["insee"] = {
        ...oldMeta,
        "mainCog": districtMouvement["DepComN"],
        "isMain": false,
        "mainId": isNew ? idCN : communesNouvelles.slice().reverse().find((item) => item)["id"]
      }
      const oldDistrict = {
        "id": formatterdDistrict.id,
        "labels": formatterdDistrict.labels,
        "meta": formatterdDistrict["meta"],
        "updateDate": new Date(codeComN.date)
      }
      communesAnciennes.push(oldDistrict)
  }

  if (TEST_COG && INSERT) {
    // Insert des communes nouvelles
    try {
      const body = JSON.stringify(fileData.communesNouvelles)
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

  if (TEST_COG && UPDATE) {
    // Update des anciennes communes
    try {
      const body = JSON.stringify(fileData.communesAnciennes)
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

  // Renommage des communes : Code_modalite : 10
  // const renamedData = dataCog2025.filter(district => district.MOD === '10')
  // const renamedCommunes = []
  // for (const districtMouvement of renamedData) {
  //   // Récupération des données d'un mouvement sur les communes
  //   const district = await getDistrictsFromCog(districtMouvement.COM_AP)
  //   const {id} = district[0]

  //   const districtPatch = {
  //     id,
  //     labels:
  //           [
  //             {
  //               value: districtMouvement.LIBELLE_AP,
  //               isoCode: 'fra'
  //             }
  //           ]
  //   }
  //   renamedCommunes.push(districtPatch)
  // }

  if (TEST_COG && PATCH) {
    // PATCH des anciennes communes
    try {
      const body = JSON.stringify(fileData.renamedCommunes)
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

  // Const deletedCommunes = []
  // for (const rmdistrict of communesNouvelles) {
  //   // Récupération des données d'un mouvement sur les communes
  //   const district = getDistrictsFromCog(rmdistrict.meta.insee.cog)
  //   deletedCommunes.push(district)
  // }

  // const results = await Promise.all(deletedCommunes)
  // const districtToDelete = []

  // for (const result of results) {
  //   for (const record of result) {
  //     if (!(fixIdNewCommunes.includes(record.id)) && record.meta.insee.isMain === true) {
  //       districtToDelete.push(record.id)
  //     }
  //   }
  // }

  // if (TEST_COG && DELETE) {
  //   // PATCH des anciennes communes
  //   try {
  //     const body = JSON.stringify(districtToDelete)
  //     const response = await fetch(`${BAN_API_URL}/district/delete`, {
  //       method: 'POST',
  //       headers: defaultHeader,
  //       body,
  //     })
  //     const result = await HandleHTTPResponse(response)
  //     console.log(result)
  //   } catch (error) {
  //     const {message} = error
  //     throw new Error(`Ban API - ${message}`)
  //   }
  // }

  process.exit(0)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
