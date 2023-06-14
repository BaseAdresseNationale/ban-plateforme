export const addressMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000000a',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001a',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000002a'],
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    number: 1,
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.23, 2.34]
      }
    }],
    updateDate: '2023-04-12'
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000b',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001a',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000002a'],
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    number: 1,
    suffix: 'bis',
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.24, 2.34]
      }
    }],
    updateDate: '2023-04-12'
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000c',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001a',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000002a'],
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    number: 2,
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    updateDate: '2023-04-12'
  }
]

export const bddAddressMock = [
  {
    _id: {
      $oid: '000000000000000000000001'
    },
    id: '00000000-0000-4fff-9fff-000000000000',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001b',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000002a'],
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    number: 10,
    suffix: 'ter',
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    updateDate: '2023-04-12'
  },
  {
    _id: {
      $oid: '000000000000000000000002'
    },
    id: '00000000-0000-4fff-9fff-000000000001',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001b',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000002a'],
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    number: 15,
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    updateDate: '2023-04-12'
  },
  {
    _id: {
      $oid: '000000000000000000000003'
    },
    id: '00000000-0000-4fff-9fff-000000000002',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001b',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000002a'],
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    number: 6,
    positions: [{
      type: 'entrée',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    updateDate: '2023-04-12'
  }
]
