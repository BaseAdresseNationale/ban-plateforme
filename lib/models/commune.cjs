const {pick, chain, keyBy, difference} = require('lodash')
const mongo = require('../util/mongo.cjs')
const {getCommuneActuelle, getRegion, getDepartement, getCommune: getCommuneCOG} = require('../util/cog.cjs')
const compositionQueue = require('../util/queue.cjs')('compose-commune')
const {prepareAdresse, prepareToponyme} = require('../formatters/geojson.cjs')
const {createPseudoCodeVoieGenerator} = require('../pseudo-codes-voies.cjs')

async function askComposition(codeCommune, options = {}, ignoreIdConfig) {
  const communeActuelle = getCommuneActuelle(codeCommune)

  if (!communeActuelle) {
    throw new Error(`Impossible de trouver la commune actuelle descendante de ${codeCommune}`)
  }

  const now = new Date()
  await mongo.db.collection('communes').findOneAndUpdate(
    {codeCommune: communeActuelle.code},
    {$set: {compositionAskedAt: now, compositionOptions: options}},
    {upsert: true}
  )
  await compositionQueue.add({codeCommune: communeActuelle.code, compositionAskedAt: now, ignoreIdConfig}, {removeOnComplete: true})
}

async function askCompositionAll() {
  await mongo.db.collection('communes').updateMany(
    {},
    {$set: {compositionAskedAt: new Date(), compositionOptions: {force: true}}}
  )
}

async function finishComposition(codeCommune) {
  await mongo.db.collection('communes').findOneAndUpdate(
    {codeCommune},
    {$unset: {compositionAskedAt: 1, compositionOptions: 1}, $set: {composedAt: new Date()}}
  )
}

function getCommune(codeCommune) {
  return mongo.db.collection('communes').findOne({codeCommune})
}

function getAskedComposition() {
  return mongo.db.collection('communes').distinct('codeCommune', {compositionAskedAt: {$exists: true}})
}

async function updateCommune(codeCommune, changes) {
  await mongo.db.collection('communes').findOneAndUpdate(
    {codeCommune},
    {$set: changes},
    {upsert: true}
  )
}

async function updateCommunesForceCertification(forceCertificationList) {
  const currentList = await mongo.db.collection('communes').distinct('codeCommune', {forceCertification: true})

  const toRemoveList = difference(currentList, forceCertificationList)
  const toAddList = difference(forceCertificationList, currentList)

  await mongo.db.collection('communes').updateMany(
    {codeCommune: {$in: toRemoveList}},
    {$set: {forceCertification: false}}
  )

  await mongo.db.collection('communes').updateMany(
    {codeCommune: {$in: toAddList}},
    {$set: {forceCertification: true}}
  )

  await Promise.all([...toRemoveList, ...toAddList].map(codeCommune => askComposition(codeCommune, {force: true})))

  return {communesAdded: toAddList, communesRemoved: toRemoveList}
}

async function saveCommuneData(codeCommune, {commune, voies, numeros}) {
  await Promise.all([
    mongo.db.collection('voies').deleteMany({codeCommune}),
    mongo.db.collection('numeros').deleteMany({codeCommune})
  ])

  await updateCommune(codeCommune, commune)

  // --------------------------------------------------------------
  // Nettoyage des voies et numeros avant insértion dans la BAN pour eviter les ID/ClésInterop en doublon sur les communes déléguée/associée :
  const indexIdVoie = new Map()
  const indexIdNumero = new Map()

  const computPseudoIdVoie = (pseudoCodeVoieGenerator, voie) => {
    if (!pseudoCodeVoieGenerator) {
      throw new Error('pseudoCodeVoieGenerator is not defined')
    }

    const {codeCommune, nomVoie, codeAncienneCommune} = voie

    let newIdVoie = `${
      codeCommune}_${
      pseudoCodeVoieGenerator.getCode(nomVoie, codeAncienneCommune)
    }`.toLowerCase()

    // Si le nouvel idVoie est deja présent dans la liste de ceux qui sont généré, alors on force sa création ?
    if ([...indexIdVoie.values()].includes(newIdVoie)) {
      newIdVoie = `${
        codeCommune}_${
        pseudoCodeVoieGenerator.forceCreateCode(nomVoie, codeAncienneCommune)
      }`.toLowerCase()
    }

    return newIdVoie
  }

  const computeIdNumero = (numero, newIdVoie) => {
    const {codeCommune, numero: numAdresse, suffixe} = numero
    const newIdNumero = `${
      codeCommune}_${
      newIdVoie}_${
      numAdresse}${
      suffixe ? `_${suffixe}` : ''
    }`.toLowerCase()
    return newIdNumero
  }

  // eslint-disable-next-line no-warning-comments
  // TODO : A appliquer quand on aura désactivé le calcule par defaut de l'ancienne commune via Gazetteer :
  // Balayer les numero et identifier les commune anciennes qui s'y trouve.
  // const balAnciennesCommunes = [...numeros.reduce(
  //   acc,
  //   ({codeAncienneCommune}) => {
  //     if(codeAncienneCommune) acc.add(codeAncienneCommune)
  //     return acc
  //   },
  //   new Set()
  // )]
  // // Si on trouve une commune ancienne, on la supprime de la BAN
  // await Promise.all(balAnciennesCommunes.map(async codeAncienneCommune => {
  //   await Promise.all([
  //     mongo.db.collection('voies').deleteMany({codeAncienneCommune}),
  //     mongo.db.collection('numeros').deleteMany({codeAncienneCommune})
  //   ])
  // }))

  // Identifier les communes déléguées/associées
  const allCodesCommunes = getCommuneActuelle(codeCommune).anciensCodes?.filter(code => code !== codeCommune)
  if (allCodesCommunes && allCodesCommunes.length > 0) {
    let countUpdatedVoies = 0
    let countUpdatedLinkedNumeros = 0
    let countUpdatedNumeros = 0

    const pseudoCodeVoieGenerator = await createPseudoCodeVoieGenerator(codeCommune)

    //  Reccuperer en BDD les idVoie des voies qui sont associés à ces communes
    const arrAllIdsVoies = await mongo.db.collection('voies').find({codeCommune: {$in: allCodesCommunes}}, {projection: ['idVoie']}).toArray()
    const allIdsVoies = new Set(arrAllIdsVoies.map(voie => voie.idVoie))
    // Comparer localement les idVoie en BBB et ceux qui vont etre inserés
    voies.forEach(voie => {
      const {idVoie} = voie
      // En cas de doublon d'idVoie, on remplace l'idVoie local par un idVoie généré
      if (allIdsVoies.has(idVoie)) {
        const newIdVoie = computPseudoIdVoie(pseudoCodeVoieGenerator, voie)
        voie.idVoie = newIdVoie
        // Voie.idVoieFantoir = voie.idVoie // Utilisé ? "Semble toujours undefined en BDD"
        indexIdVoie.set(idVoie, newIdVoie)
        countUpdatedVoies++
      }
    })

    //  Reccuperer en BDD les id des numeros qui sont associés à ces communes
    const arrAlllIdsNumeros = await mongo.db.collection('numeros').find({codeCommune: {$in: allCodesCommunes}}, {projection: ['id']}).toArray()
    const allIdsNumeros = new Set(arrAlllIdsNumeros.map(numero => numero.id))
    // Comparer localement les id en BBB et ceux qui vont etre inserés
    numeros.forEach(numero => {
      const {idVoie} = numero

      // Si le numero est positionné sur une voie qui a été modifiée...
      if (indexIdVoie.has(idVoie)) {
        // ...on remplace son idVoie par celui correspondant précedement généré...
        numero.idVoie = indexIdVoie.get(numero.idVoie)
        // Numero.idVoieFantoir = numero.idVoie
        // ...et on génère un nouvel idNumero avec le codeCommune et le nouvel idVoie
        const newIdNumero = computeIdNumero(numero, numero.idVoie)
        numero.id = newIdNumero
        // Numero.cleInterop = newIdNumero // Faut-il changer la cléInterop ?
        countUpdatedLinkedNumeros++
      }

      // En cas de doublon d'idNumero, on remplace l'idNumero local par un idNumero généré
      if (allIdsNumeros.has(numero.id)) {
        const {id} = numero
        const newIdVoie = indexIdVoie.get(numero.idVoie) || `${numero.idVoie}xDUP`
        const newIdNumero = computeIdNumero(numero, newIdVoie)
        numero.id = newIdNumero
        indexIdNumero.set(id, newIdNumero)
        countUpdatedNumeros++
      }
    })

    // En cas de modification d'idVoie ou d'idNumero, on enregistre les idVoie et idNumero modifiés dans la BDD et on les log
    if (countUpdatedVoies > 0) {
      // Enregistrer les idVoie et idNumero modifiés dans la BDD
      await pseudoCodeVoieGenerator.save()
      console.info(`[Legacy] Id de voies en doublons modifiées (sur les communes - ${allCodesCommunes.join(', ')}) : ${countUpdatedVoies}`)
      console.info(`[Legacy] Id de numero liés à des voies modifiées (sur les communes - ${allCodesCommunes.join(', ')}) : ${countUpdatedLinkedNumeros}`)
    }

    if (countUpdatedNumeros > 0) {
      console.info(`[Legacy] Id de numeros en doublons modifiées (sur les communes - ${allCodesCommunes.join(', ')}) : ${countUpdatedNumeros}`)
    }
  }
  // --------------------------------------------------------------

  if (voies && voies.length > 0) {
    await mongo.db.collection('voies').insertMany(voies, {ordered: false})
  }

  if (numeros && numeros.length > 0) {
    await mongo.db.collection('numeros').insertMany(numeros, {ordered: false})
  }
}

async function getCommuneData(codeCommune) {
  const [voies, numeros] = await Promise.all([
    mongo.db.collection('voies').find({codeCommune}).toArray(),
    mongo.db.collection('numeros').find({codeCommune}).toArray()
  ])

  return {voies, numeros}
}

async function deleteCommune(codeCommune) {
  await Promise.all([
    mongo.db.collection('communes').deleteOne({codeCommune}),
    mongo.db.collection('voies').deleteMany({codeCommune}),
    mongo.db.collection('numeros').deleteMany({codeCommune})
  ])
}

function fieldsToProj(fields) {
  return fields.reduce((acc, item) => {
    acc[item] = 1
    return acc
  }, {_id: 0})
}

async function getCommunesSummary() {
  const communeFields = [
    'nomCommune',
    'codeCommune',
    'departement',
    'region',
    'nbLieuxDits',
    'nbNumeros',
    'nbNumerosCertifies',
    'nbVoies',
    'population',
    'typeComposition',
    'analyseAdressage',
    'composedAt',
    'idRevision',
    'dateRevision'
  ]
  const communesSummaries = await mongo.db.collection('communes')
    .find({})
    .project(fieldsToProj(communeFields))
    .sort({codeCommune: 1})
    .toArray()
  return communesSummaries.flatMap(c => (c?.typeComposition
    ? [{
      ...c,
      departement: c.departement.code,
      region: c.region.code}] : []
  ))
}

async function getPopulatedCommune(codeCommune) {
  const communeFields = [
    'codeCommune',
    'banId',
    'nomCommune',
    'departement',
    'region',
    'codesPostaux',
    'population',
    'typeCommune',
    'nbNumeros',
    'nbNumerosCertifies',
    'nbVoies',
    'nbLieuxDits',
    'typeComposition',
    'displayBBox',
    'idRevision',
    'dateRevision',
    'config',
    'withBanId',
  ]

  const commune = await mongo.db.collection('communes')
    .findOne({codeCommune}, {projection: fieldsToProj(communeFields)})

  if (!commune) {
    return
  }

  const voiesFields = ['type', 'idVoie', 'banId', 'nomVoie', 'nomVoieAlt', 'sourceNomVoie', 'sources', 'nbNumeros', 'nbNumerosCertifies']

  const voies = await mongo.db.collection('voies')
    .find({codeCommune}, {projection: fieldsToProj(voiesFields)})
    .toArray()

  return {
    id: commune.codeCommune,
    type: 'commune',
    ...pick(commune, communeFields),
    voies: voies.map(v => ({id: v.idVoie, ...v}))
  }
}

async function getPopulatedVoie(idVoie) {
  const voieFields = ['type', 'idVoie', 'banId', 'nomVoie', 'nomVoieAlt', 'sourceNomVoie', 'sources', 'source', 'codeCommune', 'nbNumeros', 'nbNumerosCertifies', 'displayBBox', 'dateMAJ', 'position', 'parcelles']

  const voie = await mongo.db.collection('voies')
    .findOne({idVoie}, {projection: fieldsToProj(voieFields)})

  if (!voie) {
    return
  }

  const commune = getCommuneCOG(voie.codeCommune, true)

  const communeBAN = await mongo.db.collection('communes')
    .findOne({codeCommune: voie.codeCommune})

  const communeFields = ['nom', 'code', 'departement', 'region']

  const numeroLDFields = ['numero', 'suffixe', 'idVoie', 'parcelles', 'sources', 'position', 'positionType', 'sourcePosition', 'certifie', 'codePostal', 'libelleAcheminement', 'id', 'banId', 'dateMAJ']
  const numerosVoieFields = ['numero', 'suffixe', 'lieuDitComplementNom', 'lieuDitComplementNomAlt', 'parcelles', 'sources', 'position', 'positionType', 'sourcePosition', 'certifie', 'codePostal', 'libelleAcheminement', 'id', 'banId', 'dateMAJ']

  let numeros
  if (voie.type === 'voie') {
    numeros = await mongo.db.collection('numeros')
      .find({idVoie})
      .project(fieldsToProj(numerosVoieFields))
      .sort({cleInterop: 1})
      .toArray()
  } else {
    // Lieu-dit
    numeros = await mongo.db.collection('numeros')
      .find({lieuDitComplementNom: voie.nomVoie, codeCommune: voie.codeCommune})
      .project(fieldsToProj(numeroLDFields))
      .sort({cleInterop: 1})
      .toArray()
  }

  return {
    id: voie.idVoie,
    ...voie,
    codeCommune: undefined,
    commune: {
      id: commune.code,
      banId: communeBAN.banId,
      ...pick(commune, communeFields),
      departement: pick(getDepartement(commune.departement), 'nom', 'code'),
      region: pick(getRegion(commune.region), 'nom', 'code')
    },
    numeros
  }
}

async function getPopulatedNumero(id) {
  const numero = await mongo.db.collection('numeros').findOne({id}, {projection: {_id: 0}})

  if (!numero) {
    return
  }

  const commune = getCommuneCOG(numero.codeCommune, true)
  const communeFields = ['nom', 'code', 'departement', 'region']

  const voieFields = ['idVoie', 'nomVoie', 'nomVoieAlt']
  const voie = await mongo.db.collection('voies')
    .findOne({idVoie: numero.idVoie}, {projection: fieldsToProj(voieFields)})

  return {
    type: 'numero',
    ...numero,
    voie: {id: voie.idVoie, ...voie},
    commune: {
      id: commune.code,
      ...pick(commune, communeFields),
      departement: pick(getDepartement(commune.departement), 'nom', 'code'),
      region: pick(getRegion(commune.region), 'nom', 'code')
    },
    codeCommune: undefined,
    idVoie: undefined
  }
}

async function getAdressesFeatures(z, x, y) {
  const projection = {adressesOriginales: 0}
  const numeros = await mongo.db.collection('numeros').find({tiles: `${z}/${x}/${y}`}, {projection}).toArray()
  const idsVoies = chain(numeros).map('idVoie').uniq().value()
  const voies = await mongo.db.collection('voies').find({idVoie: {$in: idsVoies}}).toArray()
  const voiesIndex = keyBy(voies, 'idVoie')
  const features = numeros.map(n => {
    const v = voiesIndex[n.idVoie]
    return prepareAdresse(n, v)
  })

  return features
}

async function getToponymesFeatures(z, x, y) {
  const voies = await mongo.db.collection('voies').find({tiles: `${z}/${x}/${y}`}).toArray()
  return voies.map(v => prepareToponyme(v))
}

module.exports = {
  askComposition,
  getAskedComposition,
  askCompositionAll,
  finishComposition,
  getCommune,
  deleteCommune,
  saveCommuneData,
  getCommuneData,
  getPopulatedNumero,
  getPopulatedCommune,
  getPopulatedVoie,
  getAdressesFeatures,
  getToponymesFeatures,
  getCommunesSummary,
  updateCommunesForceCertification
}