import {jest} from '@jest/globals'
import {object, string, bool, array} from 'yup'
import {districtMock, bddDistrictMock} from './__mocks__/district-data-mock.js'

jest.unstable_mockModule('./models.js', async () => import('./__mocks__/district-models.js'))
const {checkDistrictsIDsRequest, checkDistrictsRequest} = await import('./utils.js')

const districtsValidationSchema = object({
  isValid: bool().required(),
  report: object({
    message: string(),
    data: array().of(string().uuid()),
  }),
})

describe('checkDistrictsIDsRequest', () => {
  it('Unavailable IDs on insert', async () => {
    const districtsValidation = await checkDistrictsIDsRequest(bddDistrictMock.map(({id}) => id), 'insert')
    const testSchema = await districtsValidationSchema.isValid(districtsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(districtsValidation?.isValid).toBe(false)
    expect(districtsValidation?.report?.data).toEqual(bddDistrictMock.map(({id}) => id))
  })

  it('Shared IDs on delete', async () => {
    const sharedID = bddDistrictMock[0].id
    const districtsValidation = await checkDistrictsIDsRequest(bddDistrictMock.map(({id}, i) => i < 2 ? sharedID : id), 'delete')
    const testSchema = await districtsValidationSchema.isValid(districtsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(districtsValidation?.isValid).toBe(false)
    expect(districtsValidation?.report?.data).toEqual([sharedID])
  })

  it('All unkown IDs', async () => {
    const districtsValidation = await checkDistrictsIDsRequest(districtMock.map(({id}) => id), 'delete')
    const testSchema = await districtsValidationSchema.isValid(districtsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(districtsValidation?.isValid).toBe(false)
    expect(districtsValidation?.report?.data).toEqual(districtMock.map(({id}) => id))
    districtMock.forEach(({id}) => expect(districtsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unkown IDs', async () => {
    const districtsValidation = await checkDistrictsIDsRequest([...districtMock, ...bddDistrictMock].map(({id}) => id), 'delete')
    const testSchema = await districtsValidationSchema.isValid(districtsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(districtsValidation?.isValid).toBe(false)
    expect(districtsValidation?.report?.data).toEqual(districtMock.map(({id}) => id))
    districtMock.forEach(({id}) => expect(districtsValidation?.report.data.includes(id)).toBe(true))
  })
})

describe('checkDistrictsRequest', () => {
  it('Shared IDs', async () => {
    const sharedID = '00000000-0000-4fff-9fff-aaaaaaaaaaaa'
    const districtsValidation = await checkDistrictsRequest(districtMock.map(district => ({...district, id: sharedID})), 'insert')
    const testSchema = await districtsValidationSchema.isValid(districtsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(districtsValidation?.isValid).toBe(false)
    expect(districtsValidation?.report?.data).toEqual([sharedID])
  })

  it('All unavailable IDs', async () => {
    const districtsValidation = await checkDistrictsRequest(bddDistrictMock.map(({_id, ...district}) => district), 'insert')
    const testSchema = await districtsValidationSchema.isValid(districtsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(districtsValidation?.isValid).toBe(false)
    expect(districtsValidation?.report?.data).toEqual(bddDistrictMock.map(({id}) => id))
    bddDistrictMock.forEach(({id}) => expect(districtsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable IDs', async () => {
    const districtsValidation = await checkDistrictsRequest([...districtMock, ...bddDistrictMock].map(({_id, ...district}) => district), 'insert')
    const testSchema = await districtsValidationSchema.isValid(districtsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(districtsValidation?.isValid).toBe(false)
    expect(districtsValidation?.report?.data).toEqual(bddDistrictMock.map(({id}) => id))
    bddDistrictMock.forEach(({id}) => expect(districtsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Available districts and IDs on Insert', async () => {
    const districtsValidation = await checkDistrictsRequest(districtMock, 'insert')
    const testSchema = await districtsValidationSchema.isValid(districtsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(districtsValidation?.isValid).toBe(true)
  })

  it('Unknown IDs on Update', async () => {
    const districtsValidation = await checkDistrictsRequest(districtMock, 'update')
    const testSchema = await districtsValidationSchema.isValid(districtsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(districtsValidation?.isValid).toBe(false)
    districtMock.forEach(({id}) => expect(districtsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Available districts on Update', async () => {
    const districtsValidation = await checkDistrictsRequest(bddDistrictMock.map(district => ({...district, label: [{isoCode: 'fra', value: 'commune F'}]})), 'update')
    const testSchema = await districtsValidationSchema.isValid(districtsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(districtsValidation?.isValid).toBe(true)
  })
})
