import {jest} from '@jest/globals'
import mongo from './mongo.cjs'

describe('MongoDB index initialization', () => {
  let collection
  let previousDb

  beforeEach(() => {
    previousDb = mongo.db
    collection = {
      indexes: jest.fn(),
      estimatedDocumentCount: jest.fn(),
      createIndex: jest.fn().mockResolvedValue('codeCommune_1')
    }
    mongo.db = {collection: jest.fn().mockReturnValue(collection)}
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    mongo.db = previousDb
    jest.restoreAllMocks()
  })

  it('creates an index on a missing collection without counting its documents', async () => {
    collection.indexes.mockRejectedValue(Object.assign(new Error('NamespaceNotFound'), {code: 26}))

    await expect(mongo.ensureIndex('voies', {idVoie: 1}, {unique: true})).resolves.toBe('built')

    expect(collection.createIndex).toHaveBeenCalledWith({idVoie: 1}, {unique: true})
    expect(collection.estimatedDocumentCount).not.toHaveBeenCalled()
  })

  it('preserves an existing index without rebuilding it', async () => {
    collection.indexes.mockResolvedValue([{key: {_id: 1}}, {key: {codeCommune: 1}}])

    await expect(mongo.ensureIndex('voies', {codeCommune: 1})).resolves.toBe('present')

    expect(collection.createIndex).not.toHaveBeenCalled()
    expect(collection.estimatedDocumentCount).not.toHaveBeenCalled()
  })

  it('adds a missing index to an existing collection', async () => {
    collection.indexes.mockResolvedValue([{key: {_id: 1}}])
    collection.estimatedDocumentCount.mockResolvedValue(42)

    await expect(mongo.ensureIndex('voies', {codeCommune: 1})).resolves.toBe('built')

    expect(collection.estimatedDocumentCount).toHaveBeenCalledTimes(1)
    expect(collection.createIndex).toHaveBeenCalledWith({codeCommune: 1}, {})
  })

  it('propagates authorization errors when listing indexes', async () => {
    const error = Object.assign(new Error('Unauthorized'), {code: 13})
    collection.indexes.mockRejectedValue(error)

    await expect(mongo.ensureIndex('voies', {codeCommune: 1})).rejects.toBe(error)

    expect(collection.createIndex).not.toHaveBeenCalled()
  })

  it('propagates document count errors', async () => {
    const error = new Error('Connection closed')
    collection.indexes.mockResolvedValue([{key: {_id: 1}}])
    collection.estimatedDocumentCount.mockRejectedValue(error)

    await expect(mongo.ensureIndex('voies', {codeCommune: 1})).rejects.toBe(error)

    expect(collection.createIndex).not.toHaveBeenCalled()
  })

  it('propagates unique index creation failures', async () => {
    const error = Object.assign(new Error('Duplicate key'), {code: 11_000})
    collection.indexes.mockResolvedValue([{key: {_id: 1}}])
    collection.estimatedDocumentCount.mockResolvedValue(2)
    collection.createIndex.mockRejectedValue(error)

    await expect(mongo.ensureIndex('voies', {idVoie: 1}, {unique: true})).rejects.toBe(error)
  })
})
