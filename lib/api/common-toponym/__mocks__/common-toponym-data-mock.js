export const commonToponymMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000000a',
    codeCommune: '12345',
    label: [{
      isoCode: 'fr',
      value: 'Rue de la baleine'
    }],
    type: {value: 'voie'},
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    dateMAJ: '2023-04-24'
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000b',
    codeCommune: '12345',
    label: [{
      isoCode: 'fr',
      value: 'Rue de la baleine'
    }],
    type: {value: 'lieu-dit'},
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    dateMAJ: '2023-04-24'
  }
]

export const bddCommonToponymMock = [
  {
    _id: {
      $oid: '000000000000000000000001'
    },
    id: '00000000-0000-4fff-9fff-000000000000',
    codeCommune: '12345',
    label: [{
      isoCode: 'fr',
      value: 'Rue du Renard'
    }],
    type: {value: 'voie'},
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    dateMAJ: '2023-04-24'
  },
  {
    _id: {
      $oid: '000000000000000000000002'
    },
    id: '00000000-0000-4fff-9fff-000000000001',
    codeCommune: '12345',
    label: [{
      isoCode: 'fr',
      value: 'Rue du Renard'
    }],
    type: {value: 'voie'},
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    dateMAJ: '2023-04-24'
  },
  {
    _id: {
      $oid: '000000000000000000000003'
    },
    id: '00000000-0000-4fff-9fff-000000000002',
    codeCommune: '12345',
    label: [{
      isoCode: 'fr',
      value: 'Rue du Renard'
    }],
    type: {value: 'voie'},
    geometry: {
      type: 'Point',
      coordinates: [1.2345, 2.3456]
    },
    dateMAJ: '2023-04-24'
  }
]