import {get} from 'lodash-es'

import formaters from './formaters.js'
import {
  getDistrictsMap,
  getDistrictFromAddress,
} from './getter-district.js'
import {
  getMicroToponymsMap,
  getMainMicroToponymFromAddress,
  getSecondaryMicroToponymsFromAddress
} from './getter-micro-toponym.js'

const convertBan = async (banData, exportConfig) => {
  const {districts, microToponyms, addresses} = banData
  const districtsMap = getDistrictsMap(districts)
  const microToponymsMap = getMicroToponymsMap(microToponyms)
  const getDistrict = getDistrictFromAddress(districtsMap)
  const getMainMicroToponym = getMainMicroToponymFromAddress(microToponymsMap)
  const getSecondaryMicroToponyms = getSecondaryMicroToponymsFromAddress(microToponymsMap)
  const exportConfigArray = Object.entries(exportConfig)

  const result = []
  for (const address of addresses) {
    const __district = getDistrict(address)
    const __microToponym = getMainMicroToponym(address)
    const __secondaryToponyms = getSecondaryMicroToponyms(address)
    const workingAddress = {
      ...address,
      __district,
      __microToponym,
      __secondaryToponyms,
    }
    result.push(
      exportConfigArray.reduce((acc, [key, value]) => {
        const [formaterName, path, ...args] = Array.isArray(value) ? value : [null, value]
        const formatValue = formaters?.[formaterName] || (v => v)
        if (value) {
          acc[key] = formatValue(get(workingAddress, path, null), ...args)
        }

        return acc
      }, {})
    )
  }

  return result
}

export default convertBan
