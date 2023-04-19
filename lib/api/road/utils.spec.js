import {jest} from '@jest/globals'
import {object, string, bool, array} from 'yup'
import {roadMock, bddRoadMock} from './__mocks__/road-data-mock.js'

jest.unstable_mockModule('./models.js', async () => import('./__mocks__/road-models.js'))
const {checkRoads} = await import('./utils.js')

const roadsValidationSchema = object({
  isValid: bool().required(),
  report: object({
    message: string(),
    data: array().of(string().uuid()),
  }),
})

describe('checkRoads', () => {
  it('Shared  IDs', async () => {
    const sharedID = '00000000-0000-4fff-9fff-aaaaaaaaaaaa'
    const roadsValidation = await checkRoads(roadMock.map(road => ({...road, id: sharedID})), 'insert')
    const testSchema = await roadsValidationSchema.isValid(roadsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(roadsValidation?.isValid).toBe(false)
    expect(roadsValidation?.report?.data).toEqual([sharedID])
  })

  it('All unavailable IDs', async () => {
    const roadsValidation = await checkRoads(bddRoadMock.map(({_id, ...road}) => road), 'insert')
    const testSchema = await roadsValidationSchema.isValid(roadsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(roadsValidation?.isValid).toBe(false)
    expect(roadsValidation?.report?.data).toEqual(bddRoadMock.map(({id}) => id))
    bddRoadMock.forEach(({id}) => expect(roadsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Some unavailable IDs', async () => {
    const roadsValidation = await checkRoads([...roadMock, ...bddRoadMock].map(({_id, ...road}) => road), 'insert')
    const testSchema = await roadsValidationSchema.isValid(roadsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(roadsValidation?.isValid).toBe(false)
    expect(roadsValidation?.report?.data).toEqual(bddRoadMock.map(({id}) => id))
    bddRoadMock.forEach(({id}) => expect(roadsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Available roads and IDs on Insert', async () => {
    const roadsValidation = await checkRoads(roadMock, 'insert')
    const testSchema = await roadsValidationSchema.isValid(roadsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(roadsValidation?.isValid).toBe(true)
  })

  it('Unknown IDs on Update', async () => {
    const roadsValidation = await checkRoads(roadMock, 'update')
    const testSchema = await roadsValidationSchema.isValid(roadsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(roadsValidation?.isValid).toBe(false)
    roadMock.forEach(({id}) => expect(roadsValidation?.report.data.includes(id)).toBe(true))
  })

  it('Available roads on Update', async () => {
    const roadsValidation = await checkRoads(bddRoadMock.map(road => ({...road, voieLabel: 'Rue de la mouette'})), 'update')
    const testSchema = await roadsValidationSchema.isValid(roadsValidation, {strict: true})
    expect(testSchema).toBe(true)
    expect(roadsValidation?.isValid).toBe(true)
  })
})
