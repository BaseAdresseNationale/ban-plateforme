import {jest} from '@jest/globals'
import {object, string, bool, array} from 'yup'
import {addressMock, addressMockForPatch, bddAddressMock} from './__mocks__/address-data-mock.js'

jest.unstable_mockModule('./models.js', async () => import('./__mocks__/address-models.js'))
jest.unstable_mockModule('../common-toponym/models.js', async () => import('../common-toponym/__mocks__/common-toponym-models.js'))
jest.unstable_mockModule('../district/models.js', async () => import('../district/__mocks__/district-models.js'))
const {checkAddressesIDsRequest, checkAddressesRequest, getDeltaReport} = await import('./utils.js')

const addressesValidationSchema = object({
  isValid: bool().required(),
  report: object({
    message: string(),
    data: array().of(string().uuid()),
  }),
})

describe('checkAddressesIDsRequest', () => {
  it('Unavailable IDs on insert', async () => {
    const addressesValidation = await checkAddressesIDsRequest(bddAddressMock.map(({id}) => id), 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(bddAddressMock.map(({id}) => id))
  })

  it('Shared IDs on delete', async () => {
    const sharedID = bddAddressMock[0].id
    const addressesValidation = await checkAddressesIDsRequest(bddAddressMock.map(({id}, i) => i < 2 ? sharedID : id), 'delete')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual([sharedID])
  })

  it('All unkown IDs on delete', async () => {
    const addressesValidation = await checkAddressesIDsRequest(addressMock.map(({id}) => id), 'delete')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(addressMock.map(({id}) => id))
    addressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unkown IDs on delete', async () => {
    const addressesValidation = await checkAddressesIDsRequest([...addressMock, ...bddAddressMock].map(({id}) => id), 'delete')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(addressMock.map(({id}) => id))
    addressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })
})

describe('checkAddressesRequest', () => {
  it('Shared IDs on insert', async () => {
    const sharedID = '00000000-0000-4fff-9fff-aaaaaaaaaaaa'
    const addressesValidation = await checkAddressesRequest(addressMock.map(addr => ({...addr, id: sharedID})), 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual([sharedID])
  })

  it('All unavailable IDs on insert', async () => {
    const addressesValidation = await checkAddressesRequest(bddAddressMock.map(({_id, ...addr}) => addr), 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(bddAddressMock.map(({id}) => id))
    bddAddressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable IDs on insert', async () => {
    const addressesValidation = await checkAddressesRequest([...addressMock, ...bddAddressMock].map(({_id, ...addr}) => addr), 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(bddAddressMock.map(({id}) => id))
    bddAddressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable common toponym IDs on insert', async () => {
    const addressesValidation = await checkAddressesRequest(addressMock.map(addr => ({...addr, mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001d'})), 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(['00000000-0000-4fff-9fff-00000000001d'])
  })

  it('Some unavailable district IDs on insert', async () => {
    const addressesValidation = await checkAddressesRequest(addressMock.map(addr => ({...addr, districtID: '00000000-0000-4fff-9fff-000000000003'})), 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(['00000000-0000-4fff-9fff-000000000003'])
  })

  it('Available addresses and IDs on insert', async () => {
    const addressesValidation = await checkAddressesRequest(addressMock, 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(true)
  })

  it('Unknown IDs on update', async () => {
    const addressesValidation = await checkAddressesRequest(addressMock, 'update')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    addressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable common toponym IDs on update', async () => {
    const addressesValidation = await checkAddressesRequest(bddAddressMock.map(({isActive, ...addrRest}) => ({...addrRest, mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001d'})), 'update')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(['00000000-0000-4fff-9fff-00000000001d'])
  })

  it('Some unavailable district IDs on update', async () => {
    const addressesValidation = await checkAddressesRequest(bddAddressMock.map(({isActive, ...addrRest}) => ({...addrRest, districtID: '00000000-0000-4fff-9fff-000000000003'})), 'update')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(['00000000-0000-4fff-9fff-000000000003'])
  })

  it('Available addresses on update', async () => {
    const addressesValidation = await checkAddressesRequest(bddAddressMock.map(({isActive, ...addrRest}) => ({...addrRest, certified: true})), 'update')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(true)
  })

  it('Unknown IDs on patch', async () => {
    const addressesValidation = await checkAddressesRequest(addressMock, 'patch')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    addressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable common toponym IDs on patch', async () => {
    const addressesValidation = await checkAddressesRequest(addressMockForPatch.map(addr => ({...addr, mainCommonToponymID: '00000000-0000-4fff-9fff-00000000001d'})), 'patch')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(['00000000-0000-4fff-9fff-00000000001d'])
  })

  it('Some unavailable district IDs on patch', async () => {
    const addressesValidation = await checkAddressesRequest(addressMockForPatch.map(addr => ({...addr, districtID: '00000000-0000-4fff-9fff-000000000003'})), 'patch')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(['00000000-0000-4fff-9fff-000000000003'])
  })

  it('Available addresses on patch', async () => {
    const addressesValidation = await checkAddressesRequest(addressMockForPatch, 'patch')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(true)
  })
})

describe('getDeltaReport', () => {
  it('Should return all ids to create and all ids from bdd to delete', async () => {
    const districtID = '00000000-0000-4fff-9fff-000000000000'
    const data = addressMock.map(({id, meta}) => ({id, hash: meta?.idfix?.hash}))
    const result = await getDeltaReport(data, districtID)
    expect(result).toEqual({
      idsToCreate: addressMock.map(({id}) => id),
      idsToUpdate: [],
      idsToDelete: bddAddressMock.map(({id}) => id),
      idsUnauthorized: []
    })
  })
  it('Should not return anything to update as hashes are equals', async () => {
    const districtID = '00000000-0000-4fff-9fff-000000000000'
    const data = bddAddressMock.map(({id, meta}) => ({id, hash: meta?.idfix?.hash}))
    const result = await getDeltaReport(data, districtID)
    expect(result).toEqual({
      idsToCreate: [],
      idsToUpdate: [],
      idsToDelete: [],
      idsUnauthorized: []
    })
  })
  it('Should return only one id to update as hashes are different', async () => {
    const districtID = '00000000-0000-4fff-9fff-000000000000'
    const data = bddAddressMock.map(({id, meta}) => ({id, hash: meta?.idfix?.hash}))
    data[0].hash = 'new-hash'
    const result = await getDeltaReport(data, districtID)
    expect(result).toEqual({
      idsToCreate: [],
      idsToUpdate: [bddAddressMock[0].id],
      idsToDelete: [],
      idsUnauthorized: []
    })
  })
})
