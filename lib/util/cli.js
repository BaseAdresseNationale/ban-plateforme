const {getCodesDepartements, getCodesCommunes} = require('../util/cog')

const codesDepartements = getCodesDepartements()

function getDepartements() {
  if (!process.env.DEPARTEMENTS) {
    return codesDepartements
  }

  const departements = process.env.DEPARTEMENTS.split(',')
  if (departements.length === 0) {
    throw new Error('La liste de départements fournie est mal formée')
  }

  if (departements.some(codeDep => !codesDepartements.includes(codeDep))) {
    throw new Error('La liste de départements fournie est invalide')
  }

  return departements
}

function getCommunes() {
  return getDepartements().reduce((acc, codeDepartement) => {
    return acc.concat(getCodesCommunes(codeDepartement) || [])
  }, [])
}

module.exports = {getDepartements, getCommunes}
