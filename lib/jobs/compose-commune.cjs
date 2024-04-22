const {isEqual, parseISO} = require('date-fns')
const {getCommune, finishComposition} = require('../models/commune.cjs')
const composeCommune = require('../compose/index.cjs')

async function handle({data: {codeCommune, compositionAskedAt, ignoreIdConfig}}) {
  const communeEntry = await getCommune(codeCommune)

  if (!communeEntry.compositionAskedAt || !isEqual(communeEntry.compositionAskedAt, parseISO(compositionAskedAt))) {
    return
  }

  console.log(`Composition des adresses de la commune ${codeCommune}`)

  await composeCommune(codeCommune, ignoreIdConfig)
  await finishComposition(codeCommune)

  console.log(`Composition des adresses de la commune ${codeCommune} terminée`)
}

module.exports = handle
