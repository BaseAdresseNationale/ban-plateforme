import {jest} from '@jest/globals'
import {object, string, bool, array} from 'yup'
import {addressMock, bddMock} from './__mocks__/data-mock.js'

jest.unstable_mockModule('./models.js', async () => import('./__mocks__/models.js'))
const {checkAddresses} = await import('./utils.js')

const addressesValidationSchema = object({
  isValid: bool().required(),
  report: object({
    message: string(),
    data: array().of(string().uuid()),
  }),
})

describe('checkAddresses', () => {
  it('Shared  IDs', async () => {
    const sharedID = '00000000-0000-4fff-9fff-aaaaaaaaaaaa'
    const addressesValidation = await checkAddresses('insert', addressMock.map(addr => ({...addr, id: sharedID})))
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual([sharedID])
  })

  it('All unavailable IDs', async () => {
    const addressesValidation = await checkAddresses('insert', bddMock.map(({_id, ...addr}) => addr))
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(bddMock.map(({id}) => id))
    bddMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable IDs', async () => {
    const addressesValidation = await checkAddresses('insert', [...addressMock, ...bddMock].map(({_id, ...addr}) => addr))
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(false)
    expect(addressesValidation?.report?.data).toEqual(bddMock.map(({id}) => id))
    bddMock.forEach(({id}) => expect(addressesValidation?.report.data.includes(id)).toBe(true))
  })

  it('Available IDs', async () => {
    const addressesValidation = await checkAddresses('insert', addressMock)
    const testSchema = await addressesValidationSchema.isValid(addressesValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(addressesValidation?.isValid).toBe(true)
  })
})
