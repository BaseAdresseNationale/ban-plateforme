const got = require('got')
const revisionHash = require('rev-hash')
const {omit} = require('lodash')
const source = require('../models/source')

async function fetchResource(resourceInfo, options = {}) {
  const requestHeaders = {}

  if (!options.force) {
    if (resourceInfo.headers && resourceInfo.headers['last-modified']) {
      requestHeaders['if-modified-since'] = resourceInfo.headers['last-modified']
    }

    if (resourceInfo.headers && resourceInfo.headers.etag) {
      requestHeaders['if-none-match'] = resourceInfo.headers.etag
    }
  }

  try {
    const response = await got(resourceInfo.url, {responseType: 'buffer', headers: requestHeaders})
    const {body, headers, statusCode} = response

    if (statusCode === 304) {
      return
    }

    const revision = revisionHash(body)

    if (!options.force && resourceInfo.revision && resourceInfo.revision === revision) {
      return
    }

    resourceInfo.headers = headers
    resourceInfo.revision = revision
    resourceInfo.data = body
    resourceInfo.size = body.length
    resourceInfo.updatedAt = new Date()
  } catch (error) {
    if (error && error.response && error.response.statusCode === 404 && options.allowNotFound) {
      resourceInfo.notFound = true
      return
    }

    throw error
  }
}

function getActualResourceInfo(partInfo, resourceName) {
  return partInfo.resources.find(r => r.name === resourceName)
}

class SourcePartUpdater {
  constructor(sourceName, partName, resourcesDefinition, options = {}) {
    this._sourceName = sourceName
    this._partName = partName
    this._definedResources = resourcesDefinition
    this._source = source(sourceName)
    this._options = options
  }

  async load() {
    const partInfo = await this._source.getPartInfo(this._partName)

    if (partInfo) {
      this._partInfo = partInfo
    } else {
      this._partInfo = {
        source: this._sourceName,
        part: this._partName,
        resources: []
      }
    }
  }

  async updateResources() {
    this._resourcesInfos = await Promise.all(this._definedResources.map(async resource => {
      const resourceInfo = {
        ...(getActualResourceInfo(this._partInfo, resource.name) || {}),
        ...resource
      }

      await fetchResource(resourceInfo, {allowNotFound: this._options.allowNotFound})
      return resourceInfo
    }))
  }

  async save() {
    const partInfo = {
      ...this._partInfo,
      resources: this._resourcesInfos.map(resourceInfo => omit(resourceInfo, 'data'))
    }
    await this._source.updatePartInfo(this._partName, partInfo)
  }

  hasNotFound() {
    return this._resourcesInfos.some(r => r.notFound)
  }

  hasChanges() {
    return this._resourcesInfos.some(resource => resource.data)
  }

  async ensureAllResourcesFetched() {
    await Promise.all(this._resourcesInfos.map(async resource => {
      if (resource.data) {
        return
      }

      await fetchResource(resource, {force: true})
    }))
  }

  getResource(resourceName) {
    return this._resourcesInfos.find(r => r.name === resourceName)
  }

  async update() {
    await this.load()
    await this.updateResources()

    if (this.hasNotFound()) {
      return
    }

    if (this.hasChanges()) {
      await this.ensureAllResourcesFetched()
    }
  }

  isResourceUpdated(resourceName) {
    return Boolean(this.getResource(resourceName).data)
  }

  getResourceData(resourceName) {
    return this.getResource(resourceName).data
  }
}

function createSourcePartUpdater(sourceName, partName, resourcesDefinition, options = {}) {
  return new SourcePartUpdater(sourceName, partName, resourcesDefinition, options)
}

module.exports = {
  createSourcePartUpdater
}
