const {findCodePostal} = require('codes-postaux/full')

function getCodePostalRecord(codeCommune, idVoie, numero, suffixe) {
  let result

  if (idVoie.length === 10) {
    const [codeCommuneVoie, codeVoie] = idVoie.toUpperCase().split('_')
    result = findCodePostal(codeCommuneVoie, codeVoie, numero, suffixe) || findCodePostal(codeCommuneVoie)
  }

  if (result && result.codeCommune === codeCommune) {
    return result
  }

  return findCodePostal(codeCommune) || {}
}

module.exports = {getCodePostalRecord}
