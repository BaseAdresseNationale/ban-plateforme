#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import data from './../data/dataCog2025/cog-insee-2025.json' with {type: 'json'}
import fixIDs from './../data/dataCog2025/fixed-ids-new-district.json' with {type: 'json'}

const ids = new Map() // cog, id
const workingData = data?.dataCog2025.filter(
    commune => commune.MOD === "32" && commune.TYPECOM_AV !== "COMA"
) || []



const UUIDV4 = (cog) => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })

    // const hasId = ids.has(cog)
    // if (hasId) {
    //     return ids.get(cog)
    // } else {
    //     // get first available of fixIDs
    //     const id = fixIDs.fixIdNewCommunes.shift() // ⚠ Warning : Mutation of fixIDs
    //     ids.set(cog, id)
    //     return id
    // }
}

console.log(workingData.length)

const getAllOldDistrictIds = async() => {
    const oldCog = (
            await Promise.all(
                [...(new Set(workingData.map(({COM_AV}) => COM_AV)))].map(
                    async (cog) => {
                        // get id from https://plateforme.adresse.data.gouv.fr/api/district/cog/{cog}
                        const response = await fetch(`https://plateforme.adresse.data.gouv.fr/api/district/cog/${cog}`)
                        const resp = await response.json()
                        if(!resp || !resp.response || !resp.response?.[0]?.id) {
                            console.log(`No response for ${cog}`)
                            throw new Error(`No response for ${cog}`)
                        }
                        return resp
                    }
                )
            )
        )
        .flatMap((data) => {
            return data.response || []
        })
        .map((response) => {
            const {id, meta} = response
            if(!meta) {
                console.log(`No meta in ${JSON.stringify(response)}`)
                return null
            }
            if(!meta.insee) {
                console.log(`No insee in ${JSON.stringify(response)}`)
                return null
            }
            if(!meta.insee.cog) {
                console.log(`No cog in ${JSON.stringify(response)}`)
                return null
            }
            if(!id) {
                console.log(`No id in ${JSON.stringify(response)}`)
                return null
            }
            return meta?.insee.cog ? [meta.insee.cog, id] : null
        })
        .filter(Boolean)
        // .flatMap((data) => data.response.map(({id, meta}) => [meta.insee.cog, id]))

        return oldCog
}

const main = async () => {


    const AllDistrict = await getAllOldDistrictIds()
    const ids = new Map(AllDistrict) // cog, id

    console.log(AllDistrict)
    console.log(AllDistrict.length)

    // interface CommuneDescription   {
    //     "id": UUIDV4,
    //     "labels": [
    //       {
    //         "value": string,
    //         "isoCode": "fra"
    //       }
    //     ],x
    //     "meta": {
    //       "insee": {
    //         "cog": CogString,
    //         "isMain": boolean,
    //         "mainId": UUIDV4,
    //         "mainCog": CogString
    //       }
    //     },
    //     "updateDate": date
    //   }

    // Get Object like this : 
    // {
    //     communesAnciennes: CommuneDescription[],
    //     communesNouvelles: CommuneDescription[],
    //     communesSupprimees: CommuneDescription[],
    //     communesModifiees: CommuneDescription[]
    // }

    // Sampler of source commune into data = 
    // {
    //     "MOD": "32",
    //     "DATE_EFF": "2025-01-01",
    //     "TYPECOM_AV": "COM",
    //     "COM_AV": "16226",
    //     "TNCC_AV": "0",
    //     "NCC_AV": "MONTIGNAC CHARENTE",
    //     "NCCENR_AV": "Montignac-Charente",
    //     "LIBELLE_AV": "Montignac-Charente",
    //     "TYPECOM_AP": "COM",
    //     "COM_AP": "16393",
    //     "TNCC_AP": "3",
    //     "NCC_AP": "BOIXE",
    //     "NCCENR_AP": "Boixe",
    //     "LIBELLE_AP": "La Boixe"
    // },

    // Modality : 
    // code_modalite	definition_modalite
    // 10	Changement de nom
    // 20	Création
    // 21	Rétablissement
    // 30	Suppression
    // 31	Fusion simple
    // 32	Création de commune nouvelle
    // 33	Fusion association
    // 34	Transformation de fusion association en fusion simple
    // 35	Suppression de commune déléguée
    // 41	Changement de code dû à un changement de département
    // 50	Changement de code dû à un transfert de chef-lieu
    // 70	Transformation de commune associée en commune déléguée
    // 71	Rétablissement de commune déléguée

    // Our only code are 10, 21, 30, 32, 35
    // For Modality 32, we have to check if the commune is a new Main commune or a linked commune
    // Add New Main commune when MOD = 32 and TYPECOM_AV= COM and TYPECOM_AP = COM
    // Update to Linked commune when MOD = 32 and TYPECOM_AV= COM and TYPECOM_AP = COMD

    // const ids = new Map()

    const mapCouvellesCommunes = new Map() // cog, commune


    const datDiff = workingData.reduce(
        (acc, commune) => {
            const { MOD, DATE_EFF, TYPECOM_AV, COM_AV, TNCC_AV, NCC_AV, NCCENR_AV, LIBELLE_AV } = commune
            const { TYPECOM_AP, COM_AP, TNCC_AP, NCC_AP, NCCENR_AP, LIBELLE_AP } = commune
            // const id = UUIDV4(COM_AV)
            const id = ids.get(COM_AV)
            if(!id) {
                console.log(`No id for ${COM_AV}`)
                throw new Error(`No id for ${COM_AV}`)
                // return acc
            }
            const communeDescription = {
                id: id,
                labels: [
                    {
                        value: LIBELLE_AV,
                        isoCode: 'fra'
                    }
                ],
                meta: {
                    insee: {
                        cog: COM_AV,
                        isMain: true,
                        mainId: id,
                        mainCog: COM_AV
                    }
                },
                updateDate: DATE_EFF
            }

            // ids.set(id, COM_AV)

            if (+MOD === 32 && TYPECOM_AV !== "COMA") {
                const tempId = UUIDV4(COM_AP)
                const hasCommuneNouvelle = mapCouvellesCommunes.has(COM_AP)
                const communeNouvelle = hasCommuneNouvelle 
                    ? mapCouvellesCommunes.get(COM_AP) 
                    : {
                        id: tempId,
                        labels: [
                            {
                                value: LIBELLE_AP,
                                isoCode: 'fra'
                            }
                        ],
                        meta: {
                            insee: {
                                cog: COM_AP,
                                isMain: true,
                                mainId: tempId,
                                mainCog: COM_AP
                            }
                        },
                        updateDate: DATE_EFF
                    }

                if (!hasCommuneNouvelle) {
                    mapCouvellesCommunes.set(COM_AP, communeNouvelle)
                }

                // if(COM_AP === COM_AV) {
                //     mapCouvellesCommunes.set(COM_AP, communeNouvelle)
                //     acc.communesNouvelles.push(communeNouvelle)
                // }

                if(TYPECOM_AV === TYPECOM_AP) {
                    if(COM_AP === COM_AV) {
                        mapCouvellesCommunes.set(COM_AP, communeNouvelle)
                        acc.communesNouvelles.push(communeNouvelle)
                    }

                    // Commune nouvelle => Modification
                    communeDescription.meta.insee.isMain = false
                    communeDescription.meta.insee.mainCog = communeNouvelle.meta.insee.cog
                    communeDescription.meta.insee.mainId = communeNouvelle.id
                    acc.communesModifiees.push(communeDescription)
                }
            }
            // else if (+MOD === 35) {
            //     // Commune supprimée
            //     acc.communesSupprimees.push(communeDescription)
            // }
            // else if (+MOD === 30) {
            //     // Commune supprimée
            //     acc.communesSupprimees.push(communeDescription)
            // }
            // else if (+MOD === 10) {
            //     communeDescription.labels[0].value = LIBELLE_AP
            //     communeDescription.meta.insee.cog = COM_AP
            //     // Commune modifiée
            //     acc.communesModifiees.push(communeDescription)
            // }
            // else if (+MOD === 21) {
            //     // Rétablissement Commune ancienne => Modification
            //     communeDescription.labels[0].value = LIBELLE_AP
            //     communeDescription.meta.insee.cog = COM_AP
            //     communeDescription.meta.insee.isMain = true
            //     communeDescription.meta.insee.mainCog = COM_AP
            //     communeDescription.meta.insee.mainId = communeDescription.id // Check if is not oldMainCommune
            //     // acc.communesAnciennes.push(communeDescription)
            //     acc.communesModifiees.push(communeDescription)
            // }
            else {
                console.log(`Unknown MOD code: ${+MOD}`)
            }
            return acc

        },
        {
            communesModifiees: [], // CODE 10
            communesNouvelles: [], // CODE 32 avec les nouveaux noms
            communesSupprimees: [], // CODE 30
        }
    )

    // console.log(data)

    const outputPath = path.join(process.cwd(), 'data', 'dataCog2025', 'cog-insee-2025-diff.json')
    const outputData = JSON.stringify(datDiff, null, 2)
    fs.writeFileSync(outputPath, outputData, 'utf-8')
    console.log(`Data written to ${outputPath}`)
}

main()