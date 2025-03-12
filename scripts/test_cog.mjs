#!/usr/bin/env node
import 'dotenv/config.js'
import {formatDistrict} from '../lib/api/district/utils.js'
import {getDistrictsFromCog} from '../lib/api/district/models.js'
import {dataCog2025, dataCogFusions2025, fixIdNewCommunes} from './dataCog2025/communes_nouvelles_2024_utf8.js'
import {communesAnciennes, communesNouvelles} from './dataCog2025/updatedCommunes.js'
import HandleHTTPResponse from '../lib/util/http-request-handler.js'
import fetch from 'node-fetch'

const BAN_API_URL = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'
const BAN_API_TOKEN = process.env.BAN_API_AUTHORIZED_TOKENS || ''
const defaultHeader = {
  Authorization: `Token ${BAN_API_TOKEN}`,
  'Content-Type': 'application/json',
};

const TEST_COG = process.env.TEST_COG === 'true' || false
const INSERT = process.env.INSERT === 'true' || false
const UPDATE = process.env.UPDATE === 'true' || false
const PATCH = process.env.PATCH === 'true' || false

async function main() { 

    //
    // Méthode de fabrication des données dans le fichier `updatedCommunes.js`
    // 

    // const data = dataCogFusions2025 // données extraites du COG 2025
    // const ids = fixIdNewCommunes
    // const communesNouvelles = [] // Communes nouvelles à créer
    // const communesAnciennes = [] // Commmunes anciennes à updater
    // var counter = 0 // Pour le parcours du fichier des Ids des nouvelles communes

    // for (const districtMouvement of data){

    //     // Récupération des données d'un mouvement sur les communes
    //     const district = await getDistrictsFromCog(districtMouvement["DepComA"])

    //     // Formattage
    //     const formatterdDistrict = formatDistrict(district[0])

    //     // Valeur de la commune nouvelle
    //     const idCN = ids[counter]
    //     var isNew = false
    //     const codeComN = {"nom": districtMouvement["NomCN"], "cog": districtMouvement["DepComN"], "date": districtMouvement["Date2"], "id": ""}

    //     // Meta de l'ancienne commune
    //     const oldMeta = formatterdDistrict["meta"]["insee"]
    //     // Commune Nouvelle rencontrée
    //     if(!(communesNouvelles.some((item) => item.meta.insee.cog == codeComN.cog))){
    //         isNew = true
    //         counter = counter + 1
    //         codeComN["id"] = idCN

    //         const newDistrict = {
    //           "id": codeComN.id,
    //           "labels": [{"value": codeComN.nom, "isoCode": 'fra'}],
    //           "meta": {
    //             "insee":{
    //               "cog": codeComN.cog,
    //               "mainCog": codeComN.cog,
    //               "isMain": true,
    //               "mainId": codeComN.id
    //             }
    //           },
    //           "updateDate": new Date(codeComN.date)   
    //         }
    //         // Ajout à la liste des objets à traiter
    //         communesNouvelles.push(newDistrict)
    //     }

    //     formatterdDistrict["meta"]["insee"] = {
    //       ...oldMeta, 
    //       "mainCog": districtMouvement["DepComN"],
    //       "isMain": false,
    //       "mainId": isNew ? idCN : communesNouvelles.slice().reverse().find((item) => item)["id"]
    //     }
    //     const oldDistrict = {
    //       "id": formatterdDistrict.id,
    //       "labels": formatterdDistrict.labels,
    //       "meta": formatterdDistrict["meta"],
    //       "updateDate": new Date(codeComN.date)   
    //     }
    //     communesAnciennes.push(oldDistrict)
    // }

    if (TEST_COG && INSERT && UPDATE){
      // Insert des communes nouvelles
        try {
          const body = JSON.stringify(communesNouvelles);
          const response = await fetch(`${BAN_API_URL}/district/`, {
            method: 'POST',
            headers: defaultHeader,
            body,
          });
          const result = await HandleHTTPResponse(response)
          console.log(result)
        } catch (error) {
          const { message } = error
          throw new Error(`Ban API - ${message}`);
        }
      
        // Update des anciennes communes
        try {
          const body = JSON.stringify(communesAnciennes);
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
 
