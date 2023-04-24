import {jest} from '@jest/globals'
import {object, string, bool, array} from 'yup'
import {addressMock, bddAddressMock} from './__mocks__/address-data-mock.js'

jest.unstable_mockModule('./models.js', async () => import('./__mocks__/address-models.js'))
const {checkAddressesIDsRequest, checkAddressesRequest} = await import('./utils.js')

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

  it('All unkown IDs', async () => {
    const addressesValidation = await checkAddressesIDsRequest(addressMock.map(({id}) => id), 'delete')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(addressMock.map(({id}) => id))
    addressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unkown IDs', async () => {
    const addressesValidation = await checkAddressesIDsRequest([...addressMock, ...bddAddressMock].map(({id}) => id), 'delete')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(addressMock.map(({id}) => id))
    addressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })
})

describe('checkAddressesRequest', () => {
  it('Shared IDs', async () => {
    const sharedID = '00000000-0000-4fff-9fff-aaaaaaaaaaaa'
    const addressesValidation = await checkAddressesRequest(addressMock.map(addr => ({...addr, id: sharedID})), 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual([sharedID])
  })

  it('All unavailable IDs', async () => {
    const addressesValidation = await checkAddressesRequest(bddAddressMock.map(({_id, ...addr}) => addr), 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(bddAddressMock.map(({id}) => id))
    bddAddressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable IDs', async () => {
    const addressesValidation = await checkAddressesRequest([...addressMock, ...bddAddressMock].map(({_id, ...addr}) => addr), 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(bddAddressMock.map(({id}) => id))
    bddAddressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Available addresses and IDs on Insert', async () => {
    const addressesValidation = await checkAddressesRequest(addressMock, 'insert')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(true)
  })

  it('Unknown IDs on Update', async () => {
    const addressesValidation = await checkAddressesRequest(addressMock, 'update')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    addressMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Available addresses on Update', async () => {
    const addressesValidation = await checkAddressesRequest(bddAddressMock.map(addr => ({...addr, certifie: true})), 'update')
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(true)
  })
})
