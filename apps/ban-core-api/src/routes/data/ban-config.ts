export const banRequestConfigs = {
  district : {
    dataName: 'snapshot_district_ndjson',
    request: `
      SELECT
        *
      FROM ban.snapshot_district_ndjson(
        $1::timestamptz,    -- at
        $2::uuid[],         -- ids
        $3::text[]          -- departements
      )
    `,
    params: ["at", "district_ids", "departements"],
  },
  toponym: {
    dataName: 'snapshot_common_toponym_ndjson',
    request: `
      SELECT
        *
      FROM ban.snapshot_common_toponym_ndjson(
        $1::timestamptz,    -- at
        $2::uuid[],         -- ids
        $3::uuid[],         -- district_ids
        $4::text[]          -- departements
      )
    `,
    params: ["at", "common_toponym_ids", "district_ids", "departements"],
  },
  address: {
    dataName: 'snapshot_address_ndjson',
    request: `
      SELECT
        *
      FROM ban.snapshot_address_ndjson(
        $1::timestamptz,    -- at
        $2::uuid[],         -- ids
        $3::uuid[],         -- common_toponym_ids
        $4::uuid[],         -- district_ids
        $5::text[]          -- departements
      )
    `,
    params: ["at", "address_ids", "common_toponym_ids", "district_ids", "departements"],
  },
};

