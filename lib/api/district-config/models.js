import {UniqueConstraintError} from 'sequelize'
import {DistrictConfig} from '../../util/sequelize.js'

/** Merge partiel ; historique géré en base (trigger → `ban.district_config_h`). */
const mergeConfig = (current, partial) => {
  if (!partial || typeof partial !== 'object') {
    return current
  }

  const next = current ? {...current} : {}
  for (const [key, value] of Object.entries(partial)) {
    if (value === null) {
      delete next[key]
    } else {
      next[key] = value
    }
  }

  return next
}

const sameConfig = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export const getDistrictConfigRow = districtId =>
  DistrictConfig.findByPk(districtId, {raw: true})

export const getDistrictConfigJson = async (districtId, options = {}) => {
  const row = await DistrictConfig.findByPk(districtId, {raw: true, ...options})
  return row?.config ?? null
}

export const upsertDistrictConfigMerge = async (districtId, partialConfig) => {
  const existing = await DistrictConfig.findByPk(districtId)
  const after = mergeConfig(existing?.config ?? null, partialConfig)

  if (existing) {
    if (sameConfig(existing.config, after)) {
      return existing
    }

    return existing.update({config: after})
  }

  try {
    return await DistrictConfig.create({districtId, config: after})
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      const row = await DistrictConfig.findByPk(districtId)
      const merged = mergeConfig(row.config ?? null, partialConfig)
      return row.update({config: merged})
    }

    throw error
  }
}

export const replaceDistrictConfig = async (districtId, newConfig) => {
  const existing = await DistrictConfig.findByPk(districtId)

  if (existing) {
    if (sameConfig(existing.config, newConfig)) {
      return existing
    }

    return existing.update({config: newConfig})
  }

  return DistrictConfig.create({districtId, config: newConfig})
}
