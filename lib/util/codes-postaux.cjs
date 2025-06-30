/* eslint-disable camelcase */
const {findCodePostal} = require('codes-postaux/full')
const dirty_fix = require('../../dataset/dirty-fix-postal-code-cog2025.json')

function getCodePostalRecord(codeCommune, idVoie, numero, suffixe) {
  try {
    let result

    if (idVoie && idVoie.length === 10) {
      const [codeCommuneVoie, codeVoie] = idVoie.toUpperCase().split('_')
      result = findCodePostal(codeCommuneVoie, codeVoie, numero, suffixe)
        || findCodePostal(codeCommuneVoie)
    }

    if (result && result.codeCommune === codeCommune) {
      return result
    }

    // Si aucun résultat trouvé, on essaie par codeCommune seul
    result = findCodePostal(codeCommune)
    if (result) {
      return result
    }

    // Si encore rien, fallback vers le dirty fix
    if (dirty_fix.dirty_fix[codeCommune]) {
      const {codePostal, libelleAcheminement} = dirty_fix.dirty_fix[codeCommune]
      return {
        codeCommune,
        codePostal,
        libelleAcheminement
      }
    }

    // Aucun résultat trouvé
    return {}
  } catch (error) {
    console.error('Error in getCodePostalRecord:', error)
    throw error
  }
}

module.exports = {getCodePostalRecord}
