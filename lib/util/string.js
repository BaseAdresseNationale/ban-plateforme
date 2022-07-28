const {trim, deburr} = require('lodash')

function slugify(str) {
  return trim(deburr(str).toLowerCase().replace(/\W+/g, '-'), ' -')
}

module.exports = {slugify}
