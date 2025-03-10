#!/usr/bin/env node
import 'dotenv/config.js'
import {formatDistrict} from '../lib/api/district/utils.js'
import {getDistrictsFromCog} from '../lib/api/district/models.js'
import {dataCog2025, dataCogFusions2025} from '../lib/api/cog/cog_data/communes_nouvelles_2024_utf8.js'
import {v4 as uuidv4} from 'uuid'
import HandleHTTPResponse from '../lib/util/http-request-handler.js'
import fetch from 'node-fetch'

const BAN_API_URL = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'
const BAN_API_TOKEN = process.env.BAN_API_AUTHORIZED_TOKENS || ''
const defaultHeader = {
  Authorization: `Token ${BAN_API_TOKEN}`,
  'Content-Type': 'application/json',
};

const TEST_COG = process.env.TEST_COG || false
const INSERT = process.env.INSERT || false
const UPDATE = process.env.UPDATE || false
const PATCH = process.env.PATCH || false

async function main() { 

    const data = dataCogFusions2025 // données extraites du COG 2025
    const communesNouvelles = [] // Communes nouvelles à créer
    const communesAnciennes = [] // Commmunes anciennes à updater

    for (const districtMouvement of data){

        // Récupération des données d'un mouvement sur les communes
        const district = await getDistrictsFromCog(districtMouvement["DepComA"])

        // Formattage
        const formatterdDistrict = formatDistrict(district[0])

        // // Vérification des communes: il faut que la pair label/id existe
        // console.assert(formatterdDistrict["id"]!=null, formatterdDistrict["id"])
        // console.assert(slugify(formatterdDistrict["labels"][0]["value"])==slugify(districtMouvement["NomCA"]), slugify(formatterdDistrict["labels"][0]["value"]) + "_" + slugify(districtMouvement["NomCA"]))

        // Nom de la commune nouvelle
        const idCN = uuidv4()
        var isNew = false
        const codeComN = {"nom": districtMouvement["NomCN"], "cog": districtMouvement["DepComN"], "date": districtMouvement["Date2"], "id": ""}

        // Meta de l'ancienne commune
        const oldMeta = formatterdDistrict["meta"]["insee"]

        // Commune Nouvelle rencontrée
        if(!(communesNouvelles.some((item) => item.meta.insee.cog == codeComN.cog))){
            isNew = true
            codeComN["id"] = idCN
            const newDistrict = {
              "id": codeComN.id,
              "labels": [{"value": codeComN.nom, "isoCode": 'fra'}],
              "meta": {
                "insee":{
                  "cog": codeComN.cog,
                  "mainCog": codeComN.cog,
                  "isMainCog": true,
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
          "isMainCog": false,
          "mainId": isNew ? idCN : communesNouvelles.slice().reverse().find((item) => item)["id"]
        }

        communesAnciennes.push(formatterdDistrict)
    }
    
    if (TEST_COG && INSERT){  // Insert des communes nouvelles
        try {
          const body = JSON.stringify(communesNouvelles);
          const response = await fetch(`${BAN_API_URL}/district/`, {
            method: 'POST',
            headers: defaultHeader,
            body,
          });
          const result = await HandleHTTPResponse(response)
          console.log(result)        } catch (error) {
          const { message } = error
          throw new Error(`Ban API - ${message}`);
        }
    }


    if(TEST_COG && UPDATE){  // Update des anciennes communes
        try {
          const body = JSON.stringify(communesAnciennes);
          const response = await fetch(`${BAN_API_URL}/district/`, {
            method: 'PATCH',
            headers: defaultHeader,
            body,
          });
          const result = await HandleHTTPResponse(response)
          console.log(result)        } catch (error) {
          const { message } = error
          throw new Error(`Ban API - ${message}`);
        }
    }



    // Renommage des communes : Code_modalite : 10
    const renamedData = dataCog2025.filter((district)=> district.MOD === '10')

    for (const districtMouvement of renamedData){
        // Récupération des données d'un mouvement sur les communes
        const district = await getDistrictsFromCog(districtMouvement.COM_AP)
        const { id } = district[0]

        const districtPatch = {
          id,
          labels:
            [
              { 
                value: districtMouvement.LIBELLE_AP,
                isoCode: "fra"
              }
            ]
          }
        if(TEST_COG && PATCH){ // PATCH des anciennes communes
          try {
            const body = JSON.stringify([districtPatch]);
            const response = await fetch(`${BAN_API_URL}/district/`, {
              method: 'PATCH',
              headers: defaultHeader,
              body,
            });
            const result = await HandleHTTPResponse(response)
            console.log(result)
          } catch (error) {
            const { message } = error
            throw new Error(`Ban API - ${message}`);
          }
        }
      }


  process.exit(0)
  
}
  main()
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
 
