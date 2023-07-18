export const commonToponymMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000000a',
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    labels: [{
      isoCode: 'fra',
      value: 'Rue de la baleine'
    }],
    type: {value: 'voie'},
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    updateDate: '2023-04-24'
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000b',
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    labels: [{
      isoCode: 'fra',
      value: 'Rue de la baleine'
    }],
    type: {value: 'lieu-dit'},
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    updateDate: '2023-04-24'
  }
]

export const bddCommonToponymMock = [
  {
    _id: {
      $oid: '000000000000000000000001'
    },
    id: '00000000-0000-4fff-9fff-000000000000',
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    labels: [{
      isoCode: 'fra',
      value: 'Rue du Renard'
    }],
    type: {value: 'voie'},
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    updateDate: '2023-04-24'
  },
  {
    _id: {
      $oid: '000000000000000000000002'
    },
    id: '00000000-0000-4fff-9fff-000000000001',
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    labels: [{
      isoCode: 'fra',
      value: 'Rue du Renard'
    }],
    type: {value: 'voie'},
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    updateDate: '2023-04-24'
  },
  {
    _id: {
      $oid: '000000000000000000000003'
    },
    id: '00000000-0000-4fff-9fff-000000000002',
    districtID: '00000000-0000-4fff-9fff-00000000003a',
    labels: [{
      isoCode: 'fra',
      value: 'Rue du Renard'
    }],
    type: {value: 'voie'},
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    updateDate: '2023-04-24'
  }
]
