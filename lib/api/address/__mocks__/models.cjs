const {bddMock} = require('./data-mock.cjs')

async function getAddresses(addressIDs) {
  return bddMock.filter(({id}) => addressIDs.includes(id))
}

module.exports = {getAddresses}
