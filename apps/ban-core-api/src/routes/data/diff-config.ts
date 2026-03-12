export const diffRequestConfigs = {
  district : {
    dataName: 'diff_district_ndjson',
    request: `
      SELECT
        *
      FROM ban.diff_district_ndjson(
        $1::timestamptz,    -- from
        $2::timestamptz,    -- to
        $3::uuid[],         -- ids
        $4::text[]          -- departements
      )
    `,
    params: ["from", "to", "district_ids", "departements"],
  },
  toponym: {
    dataName: 'diff_common_toponym_ndjson',
    request: `
      SELECT
        *
      FROM ban.diff_common_toponym_ndjson(
        $1::timestamptz,    -- from
        $2::timestamptz,    -- to
        $3::uuid[],         -- ids
        $4::uuid[],         -- district_ids
        $5::text[]          -- departements
      )
    `,
    params: ["from", "to", "common_toponym_ids", "district_ids", "departements"],
  },
  address: {
    dataName: 'diff_address_ndjson',
    request: `
      SELECT
        *
      FROM ban.diff_address_ndjson(
        $1::timestamptz,    -- from
        $2::timestamptz,    -- to
        $3::uuid[],         -- ids
        $4::uuid[],         -- common_toponym_ids
        $5::uuid[],         -- district_ids
        $6::text[]          -- departements
      )
    `,
    params: ["from", "to", "address_ids", "common_toponym_ids", "district_ids", "departements"],
  },
};
