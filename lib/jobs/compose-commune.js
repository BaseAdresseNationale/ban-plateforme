const {isEqual, parseISO} = require('date-fns')
const {getCommune, finishComposition} = require('../models/commune')
const Adresse = require('../models/adresse')
const composeCommune = require('../compose')

async function handle({data: {codeCommune, compositionAskedAt}}) {
  const communeEntry = await getCommune(codeCommune)

  if (!communeEntry.compositionAskedAt || !isEqual(communeEntry.compositionAskedAt, parseISO(compositionAskedAt))) {
    return
  }

  console.log(`Composition des adresses de la commune ${codeCommune}`)

  const {adresses, lieuxDits} = await composeCommune(codeCommune)

  await Adresse.overrideAllByCommune(codeCommune, [...adresses, ...lieuxDits])
  await finishComposition(codeCommune)
}

module.exports = handle
