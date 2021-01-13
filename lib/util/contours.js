const Keyv = require('keyv')

const contoursCommunes = new Keyv('sqlite://data/communes-50m.sqlite')
const contoursArrondissements = new Keyv('sqlite://data/arrondissements-municipaux-50m.sqlite')

async function getContour(codeCommune) {
  const contourCommune = await contoursCommunes.get(codeCommune)

  if (contourCommune) {
    return contourCommune
  }

  return contoursArrondissements.get(codeCommune)
}

module.exports = {getContour}
