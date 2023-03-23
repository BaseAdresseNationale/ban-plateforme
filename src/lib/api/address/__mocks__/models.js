const {bddMock} = require('./data-mock')

async function getAddresses(addressIDs) {
  return bddMock.filter(({id}) => addressIDs.includes(id))
}

module.exports = {getAddresses}
