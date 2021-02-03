const {minBy, pick} = require('lodash')
const leven = require('leven')
const {extractSignificantWords, normalizeBase, phonetizeWords, overlap} = require('@etalab/adresses-util/lib/voies')
const PseudoCodeVoie = require('./models/pseudo-code-voie')
const {generateBase36String} = require('./util/base36')

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

async function loadPseudoCodesVoies(codeCommune) {
  const modelCodesVoies = await PseudoCodeVoie.getAllByCommune(codeCommune)

  if (modelCodesVoies.length > 0) {
    return modelCodesVoies
  }

  return []
}

async function createPseudoCodeVoieGenerator(codeCommune) {
  let dataModified = false

  const items = (await loadPseudoCodesVoies(codeCommune))
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

  function createItem(codeVoie, nomVoie, codeAncienneCommune) {
    if (!codeVoie) {
      codeVoie = generateCodeVoie()
      codesVoies.add(codeVoie)
    }

    const item = {
      codeVoie,
      nomVoie,
      codeAncienneCommune,
      stringContext: computeStringContext(nomVoie)
    }
    items.push(item)
    dataModified = true
    return item
  }

  return {
    hasCode(codeVoie, codeAncienneCommune) {
      const scopedItems = getScopedItems(codeAncienneCommune)
      return scopedItems.some(i => i.codeVoie === codeVoie)
    },

    setCode(codeVoie, nomVoie, codeAncienneCommune) {
      createItem(codeVoie, nomVoie, codeAncienneCommune)
    },

    forceCreateCode(nomVoie, codeAncienneCommune) {
      const item = createItem(null, nomVoie, codeAncienneCommune)
      return item.codeVoie
    },

    getDistance(idVoie, nomVoie) {
      const [, codeVoie] = idVoie.split('_')
      const ctx = computeStringContext(nomVoie)
      const item = items.find(item => item.codeVoie === codeVoie)
      return leven(ctx.significantWordsString, item.stringContext.significantWordsString)
    },

    getCode(nomVoie, codeAncienneCommune) {
      const item = findItem(nomVoie, codeAncienneCommune, true) || createItem(null, nomVoie, codeAncienneCommune)
      return item.codeVoie
    },

    async save() {
      if (!dataModified) {
        return
      }

      const newPseudoCodesVoies = items
        .filter(item => !item._id)
        .map(item => {
          return {
            ...pick(item, 'codeVoie', 'nomVoie', 'codeAncienneCommune'),
            codeCommune
          }
        })

      await PseudoCodeVoie.createMany(newPseudoCodesVoies)
    }
  }
}

module.exports = {createPseudoCodeVoieGenerator}
