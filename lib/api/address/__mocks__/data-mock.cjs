const addressMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000000a',
    codeCommune: '12345',
    voieLabel: 'Rue de la baleine',
    numero: '1',
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000b',
    codeCommune: '12345',
    voieLabel: 'Rue de la baleine',
    numero: '1',
    suffixe: 'bis',
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000c',
    codeCommune: '12345',
    voieLabel: 'Rue de la baleine',
    numero: '2',
  }
]

const bddMock = [
  {
    _id: {
      $oid: '000000000000000000000001'
    },
    id: '00000000-0000-4fff-9fff-000000000000',
    codeCommune: '12345',
    voieLabel: 'Rue du Renard',
    numero: '10',
    suffixe: 'ter',
  },
  {
    _id: {
      $oid: '000000000000000000000002'
    },
    id: '00000000-0000-4fff-9fff-000000000001',
    codeCommune: '12345',
    voieLabel: 'Rue du Renard',
    numero: '15',
  },
  {
    _id: {
      $oid: '000000000000000000000003'
    },
    id: '00000000-0000-4fff-9fff-000000000002',
    codeCommune: '12345',
    voieLabel: 'Rue du Renard',
    numero: '6',
  }
]

module.exports = {
  addressMock,
  bddMock,
}
