export const commonToponymMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000000a',
    districtID: '00000000-0000-4fff-9fff-000000000000',
    labels: [{
      isoCode: 'fra',
      value: 'Rue de la baleine'
    }],
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    updateDate: new Date('2023-04-24'),
    meta: {
      idfix: {
        hash: '00c6ee2e21a7548de6260cf72c4f4b5b'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000b',
    districtID: '00000000-0000-4fff-9fff-000000000000',
    labels: [{
      isoCode: 'fra',
      value: 'Rue de la baleine'
    }],
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    updateDate: new Date('2023-04-24'),
    meta: {
      idfix: {
        hash: '58833651db311ba4bc11cb26b1900b0f'
      }
    }
  }
]

export const commonToponymMockForPatch = [
  {
    id: '00000000-0000-4fff-9fff-00000000001a',
    labels: [{
      isoCode: 'fra',
      value: 'Rue du Lapin'
    }]
  },
  {
    id: '00000000-0000-4fff-9fff-00000000001b',
    districtID: '00000000-0000-4fff-9fff-000000000001',
  },
  {
    id: '00000000-0000-4fff-9fff-00000000001c',
    geometry: {
      type: 'Point',
      coordinates: [1.2346, 2.3456]
    },
    updateDate: new Date('2023-04-24')
  }
]

export const bddCommonToponymMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000001a',
    districtID: '00000000-0000-4fff-9fff-000000000000',
    labels: [{
      isoCode: 'fra',
      value: 'Rue du Renard'
    }],
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    updateDate: new Date('2023-04-24'),
    meta: {
      idfix: {
        hash: '1a4ead8b39d17dfe89418452c9bba770'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-00000000001b',
    districtID: '00000000-0000-4fff-9fff-000000000000',
    labels: [{
      isoCode: 'fra',
      value: 'Rue du Renard'
    }],
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    updateDate: new Date('2023-04-24'),
    meta: {
      idfix: {
        hash: 'd80b0d6020798ff15e8d5416911201aa'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-00000000001c',
    districtID: '00000000-0000-4fff-9fff-000000000000',
    labels: [{
      isoCode: 'fra',
      value: 'Rue du Renard'
    }],
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    updateDate: new Date('2023-04-24'),
    meta: {
      idfix: {
        hash: '2ce8a4621b2843043725992ab2a61acc'
      }
    }
  }
]
