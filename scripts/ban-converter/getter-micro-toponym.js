export const getMicroToponymsMap = microToponyms => new Map(
  microToponyms.map(microToponym => (
    [
      microToponym.id
        || microToponym.meta?.ban?.DEPRECATED_id,
      microToponym
    ])
  )
)

export const getMainMicroToponymFromAddress = microToponymsProp => addr => (
  microToponymsProp.get(
    addr.mainMicroToponymID
    || addr.meta?.ban?.DEPRECATED_id?.split('_').slice(0, 2).join('_')
  )
)

export const getSecondaryMicroToponymsFromAddress = toponymsProp => addr => (
  addr.secondaryMicroToponymIDs?.map(
    toponymID => toponymsProp.get(toponymID)
  )
)
