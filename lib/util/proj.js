const proj = require('@etalab/project-legal')

function harmlessProj(coordinates) {
  try {
    return proj(coordinates)
  } catch {
  }
}

module.exports = {harmlessProj}
