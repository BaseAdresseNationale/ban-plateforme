export const districtMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000000a',
    label: [{
      isoCode: 'fra',
      value: 'Commune A'
    }],
    updateDate: '2023-06-22',
    meta: {
      insee: {
        cog: '12345'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000b',
    label: [{
      isoCode: 'fra',
      value: 'Commune B'
    }],
    updateDate: '2023-06-22',
    meta: {
      insee: {
        cog: '12346'
      }
    }
  },
]

export const bddDistrictMock = [
  {
    _id: {
      $oid: '000000000000000000000001'
    },
    id: '00000000-0000-4fff-9fff-000000000000',
    label: [{
      isoCode: 'fra',
      value: 'Commune C'
    }],
    updateDate: '2023-06-22',
    meta: {
      insee: {
        cog: '54321'
      }
    }
  },
  {
    _id: {
      $oid: '000000000000000000000002'
    },
    id: '00000000-0000-4fff-9fff-000000000001',
    label: [{
      isoCode: 'fra',
      value: 'Commune D'
    }],
    updateDate: '2023-06-22',
    meta: {
      insee: {
        cog: '54322'
      }
    }
  },
  {
    _id: {
      $oid: '000000000000000000000003'
    },
    id: '00000000-0000-4fff-9fff-000000000002',
    label: [{
      isoCode: 'fra',
      value: 'Commune E'
    }],
    updateDate: '2023-06-22',
    meta: {
      insee: {
        cog: '54323'
      }
    }
  }
]
