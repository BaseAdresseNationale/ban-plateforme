const localCurrentDate = (...props) =>
  new Date(...props).toLocaleString('fr-FR', {
    timeZoneName: 'short',
  })

module.exports = localCurrentDate
