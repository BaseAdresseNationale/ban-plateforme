export const addressMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000000a',
    codeCommune: '12345',
    idVoie: '00000000-0000-4fff-9fff-00000000001a',
    numero: 1,
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.23, 2.34]
      }
    }],
    dateMAJ: '2023-04-12'
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000b',
    codeCommune: '12345',
    idVoie: '00000000-0000-4fff-9fff-00000000001a',
    numero: 1,
    suffixe: 'bis',
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.24, 2.34]
      }
    }],
    dateMAJ: '2023-04-12'
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000c',
    codeCommune: '12345',
    idVoie: '00000000-0000-4fff-9fff-00000000001a',
    numero: 2,
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    dateMAJ: '2023-04-12'
  }
]

export const bddAddressMock = [
  {
    _id: {
      $oid: '000000000000000000000001'
    },
    id: '00000000-0000-4fff-9fff-000000000000',
    codeCommune: '12345',
    idVoie: '00000000-0000-4fff-9fff-00000000001b',
    numero: 10,
    suffixe: 'ter',
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    dateMAJ: '2023-04-12'
  },
  {
    _id: {
      $oid: '000000000000000000000002'
    },
    id: '00000000-0000-4fff-9fff-000000000001',
    codeCommune: '12345',
    idVoie: '00000000-0000-4fff-9fff-00000000001b',
    numero: 15,
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    dateMAJ: '2023-04-12'
  },
  {
    _id: {
      $oid: '000000000000000000000003'
    },
    id: '00000000-0000-4fff-9fff-000000000002',
    codeCommune: '12345',
    idVoie: '00000000-0000-4fff-9fff-00000000001b',
    numero: 6,
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    dateMAJ: '2023-04-12'
  }
]
