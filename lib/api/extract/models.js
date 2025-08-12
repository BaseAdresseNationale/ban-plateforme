import mongo from '../../util/mongo.cjs'

/* eslint-disable camelcase */
const projectDef = {
  districts: {
    _id: 0,
    id: '$banId',
    Labels: {
      $concatArrays: [
        [
          {
            isoCode: 'fra',
            value: '$nomCommune'
          }
        ],
        {
          $map: {
            input: {$objectToArray: {$ifNull: ['$nomCommuneAlt', {}]}},
            as: 'item',
            in: {
              isoCode: '$$item.k',
              value: '$$item.v'
            }
          }
        }
      ]
    },
    config: null,
    meta: {
      ban: {
        DEPRECATED_id: '$codeCommune',
        type: '$typeCommune',
        region: '$region',
        departement: '$departement',
        composedAt: '$composedAt',
        dateRevision: '$dateRevision',
        withBanId: '$withBanId',
        BETA_hashIdFix: '',
      },
      insee: {
        cog: '$codeCommune',
        BETA_mainCog: '',
        BETA_isMainCog: '',
      },
      laPoste: {
        codePostal: '$codesPostaux',
      }
    },
    BETA_legalityDate: '',
    BETA_lastRecordDate: '',
  },
  microToponyms: {
    _id: 0,
    id: '$banId',
    districtID: '$banIdDistrict',

    labels: {
      $concatArrays: [
        [
          {
            isoCode: 'fra',
            value: '$nomVoie'
          }
        ],
        {
          $map: {
            input: {$objectToArray: '$nomVoieAlt'},
            as: 'item',
            in: {
              isoCode: '$$item.k',
              value: '$$item.v'
            }
          }
        }
      ]
    },
    geometry: '$position',
    meta: {
      ban: {
        DEPRECATED_id: '$idVoie',
        DEPRECATED_groupId: '$groupId',
        DEPRECATED_cleInteropBAN: '$idVoieFantoir',
        BETA_cleInterop: '',
        category: '$type',
        sources: '$sources',
        sourceNomVoie: '$sourceNomVoie',
        BETA_hashIdFix: '',
      },
      dgfip: {
        BETA_cadastre: '',
        BETA_codeFantoir: '',
      },
      insee: {
        cog: '$codeCommune',
        BETA_mainCog: '',
        BETA_isMainCog: '',
      },
      laPoste: {
        codePostal: ['$codePostal'],
      }
    },
    BETA_legalityDate: '',
    BETA_lastRecordDate: '',
  },
  addresses: {
    _id: 0,
    id: '$banId',
    mainMicroToponymID: '$banIdMainCommonToponym', // TODO: Use $banIdMainMicroToponym when available
    secondaryMicroToponymIDs: '$banIdSecondaryCommonToponyms', // TODO: Use $banIdSecondaryMicroToponyms when available
    districtID: '$banIdDistrict',
    labels: {
      $concatArrays: [
        [
          {
            isoCode: 'fra',
            value: '$lieuDitComplementNom'
          }
        ],
        {
          $map: {
            input: {$objectToArray: '$lieuDitComplementNomAlt'},
            as: 'item',
            in: {
              isoCode: '$$item.k',
              value: '$$item.v'
            }
          }
        }
      ]
    },
    number: '$numero',
    suffix: '$suffixe',
    certified: '$certifie',
    positions: {
      $concatArrays: [
        [
          {
            type: '$positionType',
            geometry: '$position'
          }
        ],
        {
          $map: {
            input: '$positions',
            as: 'pos',
            in: {
              type: '$$pos.positionType',
              geometry: '$$pos.position'
            }
          }
        }
      ]
    },
    meta: {
      ban: {
        DEPRECATED_id: '$id',
        DEPRECATED_cleInteropBAN: '$cleInterop',
        cleInterop: {$arrayElemAt: ['$adressesOriginales.cleInterop', 0]},
        sources: '$sources',
        sourcePosition: '$sourcePosition',
        BETA_hashIdFix: ''
      },
      dgfip: {
        cadastre: '$parcelles',
        BETA_fantoir: '',
      },
      insee: {
        cog: '$codeCommune',
        BETA_mainCog: '',
        BETA_isMainCog: '',
      },
      laPoste: {
        codePostal: '$codePostal',
      }
    },
    legalityDate: '$dateMAJ',
    BETA_lastRecordDate: '',
  },
}

const projectList = {
  districts: {
    collection: 'communes',
    pageSize: 1,
    project: projectDef.districts,
  },
  microToponyms: {
    collection: 'voies',
    pageSize: 100,
    project: projectDef.microToponyms,
  },
  addresses: {
    collection: 'numeros',
    pageSize: 100,
    project: projectDef.addresses,
  },
}
/* eslint-enable camelcase */

const loadData = db => async ({param = {}, onStart, onData, onEnd}) => {
  const {cogList = [], project, collection, pageSize = 1} = param

  if (!cogList || !Array.isArray(cogList)) {
    throw new Error('"COG List" (cogList) param is not an array')
  }

  if (!project) {
    throw new Error('"Project" (project) param is not defined')
  }

  if (!collection) {
    throw new Error('"Collection" (collection) param is not defined')
  }

  if (typeof pageSize !== 'number' || pageSize < 1) {
    throw new Error('"Page size" (pageSize) param is not a positive number')
  }

  const filter = (!cogList || cogList.length === 0) ? [] : [{$match: {codeCommune: {$in: cogList}}}]
  let pageNumber = 0
  let hasMoreResults = true

  onStart?.(param)

  while (hasMoreResults) {
    const data = await db.collection(collection).aggregate([ // eslint-disable-line no-await-in-loop
      ...filter,
      {$project: project},
      {$skip: pageNumber * pageSize},
      {$limit: pageSize}
    ]).toArray()

    if (data.length === 0) {
      hasMoreResults = false
    }

    onData?.(data, {param, pageNumber, hasMoreResults})

    if (data.length > 0) {
      pageNumber++
    }
  }

  return onEnd?.(param)
}

const getGetterEntries = db => (cogList = []) => async (projectName, {onStart, onData, onEnd} = {}) => {
  const {collection, pageSize, project} = projectList[projectName]
  return loadData(db)({
    param: {cogList, collection, projectName, project, pageSize},
    onStart,
    onData,
    onEnd,
  })
}

export const streamBanDataFromCog = writeStream => async (cogList = []) => {
  const {db} = mongo
  const separator = ','

  const getterOptions = {
    onStart: () => writeStream.write('['),
    onData(data, {pageNumber, hasMoreResults}) {
      if (pageNumber > 0 && hasMoreResults) {
        writeStream.write(separator)
      }

      data.forEach((entry, index) => {
        if (index > 0) {
          writeStream.write(separator)
        }

        writeStream.write(JSON.stringify(entry))
      })
    },
    onEnd: () => writeStream.write(']'),
  }

  const writeHeadResponse = response => {
    response.write(JSON.stringify({
      date: new Date(),
      status: 'success',
    }).replace(/}$/, ', "response": '))
  }

  const writeFootResponse = response => {
    response.write('}')
  }

  const getEntries = getGetterEntries(db)(cogList)

  writeHeadResponse(writeStream)
  writeStream.write('{')

  let isFirst = true
  for (const projectName in projectList) {
    if (Object.hasOwn(projectList, projectName)) {
      if (!isFirst) {
        writeStream.write(separator)
      }

      writeStream.write(`"${projectName}": `)
      await getEntries(projectName, getterOptions) // eslint-disable-line no-await-in-loop

      isFirst = false
    }
  }

  writeStream.write('}')
  writeFootResponse(writeStream)

  return true
}

export const testIsEnabledCog = async cog => {
  const communesCollection = mongo.db.collection('communes')
  const result = await communesCollection.find({codeCommune: cog}).count()

  return result > 0
}
