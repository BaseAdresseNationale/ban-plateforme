#!/usr/bin/env node
import 'dotenv/config.js'
import {formatDistrict} from '../lib/api/district/utils.js'
import {getDistrictsFromCog} from '../lib/api/district/models.js'
import {dataCog2025} from '../lib/api/cog/cog_data/communes_nouvelles_2024_utf8.js'
import { slugify } from '../lib/util/string.cjs'
import {v4 as uuidv4} from 'uuid'
async function main() { 

    const data = dataCog2025 // données extraites du COG 2025
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
            console.log(codeComN.date)
            // Ajout à la liste des objets à traiter
            communesNouvelles.push(newDistrict)
        }
        formatterdDistrict["meta"]["insee"] = {
          ...oldMeta, 
          "mainCog": districtMouvement["DepComN"],
          "isMainCog": false,
          "mainId": isNew ? idCN : communesNouvelles.findLast((item) => item)["id"]
        }

        communesAnciennes.push(formatterdDistrict)
    }

  process.exit(0)
  
}
  main()
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
 
