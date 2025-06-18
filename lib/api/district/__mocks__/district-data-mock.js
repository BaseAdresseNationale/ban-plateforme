export const districtMock = [
  {
    id: '00000000-0000-4fff-9fff-00000000000a',
    labels: [{
      isoCode: 'fra',
      value: 'Commune A'
    }],
    updateDate: new Date('2023-06-22'),
    meta: {
      insee: {
        cog: '12345',
        mainCog: '12345',
        isMain: true,
        mainId: '00000000-0000-4fff-9fff-00000000000a'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-00000000000b',
    labels: [{
      isoCode: 'fra',
      value: 'Commune B'
    }],
    updateDate: new Date('2023-06-22'),
    meta: {
      insee: {
        cog: '12346',
        mainCog: '12345',
        isMain: false,
        mainId: '00000000-0000-4fff-9fff-00000000000a'
      }
    }
  },
]

export const districtMockForPatch = [
  {
    id: '00000000-0000-4fff-9fff-000000000000',
    labels: [{
      isoCode: 'fra',
      value: 'Commune F'
    }]
  },
  {
    id: '00000000-0000-4fff-9fff-000000000001',
    updateDate: new Date('2023-06-23'),
  },
  {
    id: '00000000-0000-4fff-9fff-000000000002',
    meta: {
      insee: {
        cog: '54324'
      }
    }
  }
]

export const bddDistrictMock = [
  {
    id: '00000000-0000-4fff-9fff-000000000000',
    labels: [{
      isoCode: 'fra',
      value: 'Commune C'
    }],
    updateDate: new Date('2023-06-22'),
    meta: {
      insee: {
        cog: '54321',
        mainCog: '54323',
        isMain: false,
        mainId: '00000000-0000-4fff-9fff-000000000002'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-000000000001',
    labels: [{
      isoCode: 'fra',
      value: 'Commune D'
    }],
    updateDate: new Date('2023-06-22'),
    meta: {
      insee: {
        cog: '54322',
        mainCog: '54323',
        isMain: false,
        mainId: '00000000-0000-4fff-9fff-000000000002'
      }
    }
  },
  {
    id: '00000000-0000-4fff-9fff-000000000002',
    labels: [{
      isoCode: 'fra',
      value: 'Commune E'
    }],
    updateDate: new Date('2023-06-22'),
    meta: {
      insee: {
        cog: '54323',
        mainCog: '54323',
        isMain: true,
        mainId: '00000000-0000-4fff-9fff-000000000002'
      }
    }
  }
]
