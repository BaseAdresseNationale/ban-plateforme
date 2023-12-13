export const addressMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000000a',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001a',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000001b', '00000000-0000-4fff-9fff-00000000001c'],
    districtID: '00000000-0000-4fff-9fff-000000000000',
    number: 1,
    positions: [{
      type: 'entrance',
      geometry: {
        type: 'Point',
        coordinates: [1.23, 2.34]
      }
    }],
    updateDate: new Date('2023-04-12'),
    meta: {
      idfix: {
        hash: '00c6ee2e21a7548de6260cf72c4f4b5b'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000b',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001a',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000001b', '00000000-0000-4fff-9fff-00000000001c'],
    districtID: '00000000-0000-4fff-9fff-000000000000',
    number: 1,
    suffix: 'bis',
    positions: [{
      type: 'entrance',
      geometry: {
        type: 'Point',
        coordinates: [1.24, 2.34]
      }
    }],
    updateDate: new Date('2023-04-12'),
    meta: {
      idfix: {
        hash: '58833651db311ba4bc11cb26b1900b0f'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000c',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001a',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000001b', '00000000-0000-4fff-9fff-00000000001c'],
    districtID: '00000000-0000-4fff-9fff-000000000000',
    number: 2,
    positions: [{
      type: 'entrance',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    updateDate: new Date('2023-04-12'),
    meta: {
      idfix: {
        hash: '1a4ead8b39d17dfe89418452c9bba770'
      }
    }
  }
]

export const addressMockForPatch = [
  {
    id: '00000000-0000-4fff-9fff-00000000002a',
    number: 11,
  },
  {
    id: '00000000-0000-4fff-9fff-00000000002b',
    positions: [{
      type: 'entrance',
      geometry: {
        type: 'Point',
        coordinates: [1.27, 2.34]
      }
    }]
  },
  {
    id: '00000000-0000-4fff-9fff-00000000002c',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001b',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000001c'],
  }
]

export const bddAddressMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000002a',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001a',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000001b', '00000000-0000-4fff-9fff-00000000001c'],
    districtID: '00000000-0000-4fff-9fff-000000000000',
    number: 10,
    suffix: 'ter',
    positions: [{
      type: 'entrance',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    updateDate: new Date('2023-04-12'),
    meta: {
      idfix: {
        hash: 'd80b0d6020798ff15e8d5416911201aa'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-00000000002b',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001a',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000001b', '00000000-0000-4fff-9fff-00000000001c'],
    districtID: '00000000-0000-4fff-9fff-000000000000',
    number: 15,
    positions: [{
      type: 'entrance',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    updateDate: new Date('2023-04-12'),
    meta: {
      idfix: {
        hash: '2ce8a4621b2843043725992ab2a61acc'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-00000000002c',
    mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001a',
    secondaryCommonToponymIDs: ['00000000-0000-4fff-9fff-00000000001b', '00000000-0000-4fff-9fff-00000000001c'],
    districtID: '00000000-0000-4fff-9fff-000000000000',
    number: 6,
    positions: [{
      type: 'entrance',
      geometry: {
        type: 'Point',
        coordinates: [1.25, 2.34]
      }
    }],
    updateDate: new Date('2023-04-12'),
    meta: {
      idfix: {
        hash: 'be796e420febda49c29e38745db3cae2'
      }
    }
  }
]
