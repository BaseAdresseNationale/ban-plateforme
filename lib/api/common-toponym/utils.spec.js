import {jest} from '@jest/globals'
import {object, string, bool, array} from 'yup'
import {commonToponymMock, commonToponymMockForPatch, bddCommonToponymMock} from './__mocks__/common-toponym-data-mock.js'

jest.unstable_mockModule('./models.js', async () => import('./__mocks__/common-toponym-models.js'))
jest.unstable_mockModule('../district/models.js', async () => import('../district/__mocks__/district-models.js'))
const {checkCommonToponymsRequest, checkCommonToponymsIDsRequest, getDeltaReport} = await import('./utils.js')

const commonToponymsValidationSchema = object({
  isValid: bool().required(),
  report: object({
    message: string(),
    data: array().of(string().uuid()),
  }),
})

describe('checkCommonToponymsIDsRequest', () => {
  it('Unavailable IDs on insert', async () => {
    const commonToponymsValidation = await checkCommonToponymsIDsRequest(bddCommonToponymMock.map(({id}) => id), 'insert')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual(bddCommonToponymMock.map(({id}) => id))
  })

  it('Shared IDs on delete', async () => {
    const sharedID = bddCommonToponymMock[0].id
    const commonToponymsValidation = await checkCommonToponymsIDsRequest(bddCommonToponymMock.map(({id}, i) => i < 2 ? sharedID : id), 'delete')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual([sharedID])
  })

  it('All unkown IDs on delete', async () => {
    const commonToponymsValidation = await checkCommonToponymsIDsRequest(commonToponymMock.map(({id}) => id), 'delete')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual(commonToponymMock.map(({id}) => id))
    commonToponymMock.forEach(({id}) => expect(commonToponymsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unkown IDs on delete', async () => {
    const commonToponymsValidation = await checkCommonToponymsIDsRequest([...commonToponymMock, ...bddCommonToponymMock].map(({id}) => id), 'delete')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual(commonToponymMock.map(({id}) => id))
    commonToponymMock.forEach(({id}) => expect(commonToponymsValidation?.report.data.includes(id)).toBe(true))
  })
})

describe('checkCommonToponymsRequest', () => {
  it('Shared IDs on insert', async () => {
    const sharedID = '00000000-0000-4fff-9fff-aaaaaaaaaaaa'
    const commonToponymsValidation = await checkCommonToponymsRequest(commonToponymMock.map(commonToponym => ({...commonToponym, id: sharedID})), 'insert')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual([sharedID])
  })

  it('All unavailable IDs on insert', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(bddCommonToponymMock.map(({_id, ...commonToponym}) => commonToponym), 'insert')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual(bddCommonToponymMock.map(({id}) => id))
    bddCommonToponymMock.forEach(({id}) => expect(commonToponymsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable IDs on insert', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest([...commonToponymMock, ...bddCommonToponymMock].map(({_id, ...commonToponym}) => commonToponym), 'insert')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual(bddCommonToponymMock.map(({id}) => id))
    bddCommonToponymMock.forEach(({id}) => expect(commonToponymsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable district IDs on insert', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(commonToponymMock.map(commonToponym => ({...commonToponym, districtID: '00000000-0000-4fff-9fff-000000000003'})), 'insert')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual(['00000000-0000-4fff-9fff-000000000003'])
  })

  it('Available commonToponyms and IDs on insert', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(commonToponymMock, 'insert')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(true)
  })

  it('Unknown IDs on update', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(commonToponymMock, 'update')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    commonToponymMock.forEach(({id}) => expect(commonToponymsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable district IDs on update', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(bddCommonToponymMock.map(({isActive, ...commonToponymRest}) => ({...commonToponymRest, districtID: '00000000-0000-4fff-9fff-000000000003'})), 'update')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual(['00000000-0000-4fff-9fff-000000000003'])
  })

  it('Available commonToponyms on update', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(bddCommonToponymMock.map(({isActive, ...commonToponymRest}) => ({...commonToponymRest, labels: [{isoCode: 'fra', value: 'Rue de la mouette'}]})), 'update')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(true)
  })

  it('Unknown IDs on patch', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(commonToponymMock, 'patch')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    commonToponymMock.forEach(({id}) => expect(commonToponymsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable district IDs on patch', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(commonToponymMockForPatch.map(addr => ({...addr, districtID: '00000000-0000-4fff-9fff-000000000003'})), 'patch')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual(['00000000-0000-4fff-9fff-000000000003'])
  })

  it('Available addresses on patch', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(commonToponymMockForPatch, 'patch')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(true)
  })
})

describe('getDeltaReport', () => {
  it('Should return all ids to create and all ids from bdd to delete', async () => {
    const districtID = '00000000-0000-4fff-9fff-000000000000'
    const data = commonToponymMock.map(({id, meta}) => ({id, hash: meta?.idfix?.hash}))
    const result = await getDeltaReport(data, districtID)
    expect(result).toEqual({
      idsToCreate: commonToponymMock.map(({id}) => id),
      idsToUpdate: [],
      idsToDelete: bddCommonToponymMock.map(({id}) => id),
    })
  })
  it('Should not return anything to update as hashes are equals', async () => {
    const districtID = '00000000-0000-4fff-9fff-000000000000'
    const data = bddCommonToponymMock.map(({id, meta}) => ({id, hash: meta?.idfix?.hash}))
    const result = await getDeltaReport(data, districtID)
    expect(result).toEqual({
      idsToCreate: [],
      idsToUpdate: [],
      idsToDelete: [],
    })
  })
  it('Should return only one id to update as hashes are different', async () => {
    const districtID = '00000000-0000-4fff-9fff-000000000000'
    const data = bddCommonToponymMock.map(({id, meta}) => ({id, hash: meta?.idfix?.hash}))
    data[0].hash = 'new-hash'
    const result = await getDeltaReport(data, districtID)
    expect(result).toEqual({
      idsToCreate: [],
      idsToUpdate: [bddCommonToponymMock[0].id],
      idsToDelete: [],
    })
  })
})
