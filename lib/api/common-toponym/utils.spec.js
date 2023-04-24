import {jest} from '@jest/globals'
import {object, string, bool, array} from 'yup'
import {commonToponymMock, bddCommonToponymMock} from './__mocks__/common-toponym-data-mock.js'

jest.unstable_mockModule('./models.js', async () => import('./__mocks__/common-toponym-models.js'))
const {checkCommonToponymsRequest} = await import('./utils.js')

const commonToponymsValidationSchema = object({
  isValid: bool().required(),
  report: object({
    message: string(),
    data: array().of(string().uuid()),
  }),
})

describe('checkCommonToponymsRequest', () => {
  it('Shared  IDs', async () => {
    const sharedID = '00000000-0000-4fff-9fff-aaaaaaaaaaaa'
    const commonToponymsValidation = await checkCommonToponymsRequest(commonToponymMock.map(commonToponym => ({...commonToponym, id: sharedID})), 'insert')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual([sharedID])
  })

  it('All unavailable IDs', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(bddCommonToponymMock.map(({_id, ...commonToponym}) => commonToponym), 'insert')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual(bddCommonToponymMock.map(({id}) => id))
    bddCommonToponymMock.forEach(({id}) => expect(commonToponymsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable IDs', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest([...commonToponymMock, ...bddCommonToponymMock].map(({_id, ...commonToponym}) => commonToponym), 'insert')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    expect(commonToponymsValidation?.report?.data).toEqual(bddCommonToponymMock.map(({id}) => id))
    bddCommonToponymMock.forEach(({id}) => expect(commonToponymsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Available commonToponyms and IDs on Insert', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(commonToponymMock, 'insert')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(true)
  })

  it('Unknown IDs on Update', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(commonToponymMock, 'update')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(false)
    commonToponymMock.forEach(({id}) => expect(commonToponymsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Available commonToponyms on Update', async () => {
    const commonToponymsValidation = await checkCommonToponymsRequest(bddCommonToponymMock.map(commonToponym => ({...commonToponym, label: [{isoCode: 'fr', value: 'Rue de la mouette'}]})), 'update')
    const testSchema = await commonToponymsValidationSchema.isValid(commonToponymsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(commonToponymsValidation?.isValid).toBe(true)
  })
})
