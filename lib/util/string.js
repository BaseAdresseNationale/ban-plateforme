const {trim, deburr} = require('lodash')
const {beautify} = require('@etalab/adresses-util/lib/voies')

function slugify(str) {
  return trim(deburr(str).toLowerCase().replace(/\W+/g, '-'), ' -')
}

function beautifyUppercased(str) {
  return str === str.toUpperCase()
    ? beautify(str)
    : str
}

module.exports = {slugify, beautifyUppercased}
