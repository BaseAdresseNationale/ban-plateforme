const {minBy, pick} = require('lodash')
const leven = require('leven')
const {extractSignificantWords, normalizeBase, phonetizeWords, overlap} = require('@etalab/adresses-util/lib/voies')
const {generateBase36String} = require('./util/base36')
const {CommunesDb} = require('./util/storage')

const db = new CommunesDb('pseudo-codes-voies')

function computeStringContext(str) {
  const normalizedString = normalizeBase(str)
  const significantWords = extractSignificantWords(normalizedString)
  const significantWordsString = significantWords.join(' ')
  const phoneticString = phonetizeWords(significantWords)
  return {normalizedString, phoneticString, significantWords, significantWordsString}
}

function selectBestResult(results, ctx) {
  return minBy(results, r => {
    return leven(ctx.normalizedString, r.stringContext.normalizedString)
  })
}

async function createPseudoCodeVoieGenerator(codeCommune) {
  const items = (await db.getCommune(codeCommune) || [])
    .map(item => ({...item, stringContext: computeStringContext(item.nomVoie)}))

  const codesVoies = new Set(items.map(i => i.codeVoie))

  const stats = {
    significantWords: 0,
    phonetic: 0,
    overlap: 0,
    failed: 0,
    tooShort: 0
  }

  function getScopedItems(codeAncienneCommune) {
    if (codeAncienneCommune) {
      return items.filter(e => e.codeAncienneCommune === codeAncienneCommune)
    }

    return items
  }

  function findItem(nomVoie, codeAncienneCommune, forceScope = false) {
    const ctx = computeStringContext(nomVoie)

    const scopedItems = getScopedItems(codeAncienneCommune)

    // SIGNIFICANT WORDS
    const significantWordsCompareResults = scopedItems.filter(item => {
      return item.stringContext.significantWordsString === ctx.significantWordsString
    })

    if (significantWordsCompareResults.length > 0) {
      stats.significantWords++
      return selectBestResult(significantWordsCompareResults, ctx)
    }

    // PHONETIC
    const phoneticCompareResults = scopedItems.filter(item => {
      return item.stringContext.phoneticString === ctx.phoneticString
    })

    if (phoneticCompareResults.length > 0) {
      stats.phonetic++
      return selectBestResult(phoneticCompareResults, ctx)
    }

    // OVERLAPPING
    const overlapCompareResults = scopedItems.filter(item => {
      return overlap(item.stringContext.significantWords, ctx.significantWords)
    })

    if (overlapCompareResults.length > 0) {
      stats.overlap++
      return selectBestResult(overlapCompareResults, ctx)
    }

    if (codeAncienneCommune && !forceScope) {
      return findItem(nomVoie)
    }

    stats.failed++
  }

  function generateCodeVoie() {
    const codeVoie = generateBase36String(6)

    if (codesVoies.has(codeVoie)) {
      return generateCodeVoie()
    }

    return codeVoie
  }

  function createItem(nomVoie, codeAncienneCommune) {
    const codeVoie = generateCodeVoie()
    codesVoies.add(codeVoie)
    const item = {
      codeVoie,
      nomVoie,
      codeAncienneCommune,
      stringContext: computeStringContext(nomVoie)
    }
    items.push(item)
    return item
  }

  return {
    getCode(nomVoie, codeAncienneCommune) {
      const item = findItem(nomVoie, codeAncienneCommune, true) || createItem(nomVoie, codeAncienneCommune)
      return item.codeVoie
    },

    async save() {
      await db.setCommune(codeCommune, items.map(e => pick(e, 'codeVoie', 'nomVoie', 'codeAncienneCommune')))
    }
  }
}

module.exports = {createPseudoCodeVoieGenerator}
