export const getDistrictsMap = districts => new Map(
  districts.map(
    district => ([
      district.id
          || district.meta?.ban?.DEPRECATED_id
          || district.meta?.insee?.cog,
      district
    ])
  )
)

export const getDistrictFromAddress = districtsProp => addr => (
  districtsProp.get(addr.districtID || addr.meta?.insee?.cog)
)

