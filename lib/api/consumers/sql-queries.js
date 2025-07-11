// QUERIES
export const createCommonToponymTempTableQuery = tempTableName => `
  CREATE TEMP TABLE ${tempTableName} AS
  WITH base_common_toponym AS (
    SELECT 
        ct.id,
        ct."districtID",
        ct.labels,
        ct.geometry,
        ct."updateDate",
        ct.meta,
        ct.range_validity,
        ct."isActive"
    FROM ban.common_toponym ct
    WHERE ct."isActive" = true 
      AND ct."districtID" = :districtID
  ),
  common_toponym_with_addresses AS (
      SELECT 
          bct.*,
          st_centroid(
              st_collect(
                  st_setsrid(
                      st_geomfromgeojson(addr.positions[1] -> 'geometry'::text),
                      4326
                  )
              )
          ) AS centroid,
          count(addr.id) AS "addressCount",
          count(DISTINCT CASE WHEN addr.certified = true THEN addr.id ELSE NULL END) AS "certifiedAddressCount",
          CASE
              WHEN count(addr.id) = 0 THEN 
                  st_transform(
                      st_buffer(
                          st_transform(
                              st_envelope(st_setsrid(st_geomfromgeojson(bct.geometry), 4326)),
                              2154
                          ), 
                          100::double precision,
                          'join=mitre endcap=square'::text
                      ), 
                      4326
                  )
              ELSE 
                  st_transform(
                      st_buffer(
                          st_transform(
                              st_envelope(
                                  st_collect(
                                      st_setsrid(st_geomfromgeojson(addr.positions[1] -> 'geometry'::text), 4326)
                                  )
                              ),
                              2154
                          ), 
                          50::double precision,
                          'join=mitre endcap=square'::text
                      ),
                      4326
                  )
          END AS bbox
      FROM base_common_toponym bct
      LEFT JOIN ban.address addr 
          ON bct.id = addr."mainCommonToponymID" 
        AND addr."isActive"
      GROUP BY 
          bct.id,
          bct."districtID",
          bct.labels,
          bct.geometry,
          bct."updateDate",
          bct.meta,
          bct.range_validity,
          bct."isActive"
  ),
  common_toponym_with_metadata AS (
      SELECT 
          ctwa.*,
          (distr.meta -> 'insee'::text) ->> 'cog'::text AS insee_com,
          dn."postalCodes" AS postalcodes,
          array_length(dn."postalCodes", 1) AS nb_postalcodes,
          dn."libelleAcheminementWithPostalCodes"
      FROM common_toponym_with_addresses ctwa
      LEFT JOIN ban.district distr 
          ON ctwa."districtID" = distr.id
      LEFT JOIN external.datanova dn 
          ON ((distr.meta -> 'insee'::text) ->> 'cog'::text) = dn."inseeCom"::text
  ),
  postal_matches AS (
      SELECT 
          ctwm.id,
          ctwm.insee_com,
          pa."postalCode",
          pa."inseeCom",
          pa.geometry,
          st_area(
              st_intersection(
                  st_transform(ctwm.bbox, 2154),
                  st_transform(pa.geometry, 2154)
              )
          ) AS intersect_area
      FROM common_toponym_with_metadata ctwm
      JOIN external.postal_area pa 
          ON ctwm.insee_com = pa."inseeCom"::text
      WHERE st_intersects(
          st_transform(ctwm.bbox, 2154),
          st_transform(pa.geometry, 2154)
      )
  ),
  ranked_postal_matches AS (
      SELECT 
          pm.id,
          pm."postalCode",
          pm.intersect_area,
          ROW_NUMBER() OVER (PARTITION BY pm.id ORDER BY pm.intersect_area DESC) AS rank
      FROM postal_matches pm
  ),
  best_postal_match AS (
      SELECT 
          rpm.id,
          rpm."postalCode",
          rpm.intersect_area
      FROM ranked_postal_matches rpm
      WHERE rpm.rank = 1
  )
  SELECT 
      ctwm.id,
      ctwm."districtID",
      ctwm.labels,
      ctwm.geometry,
      ctwm."updateDate",
      ctwm.meta,
      ctwm.range_validity,
      ctwm."isActive",
      ctwm.centroid,
      ctwm.bbox,
      ctwm."addressCount",
      ctwm."certifiedAddressCount",
      ctwm.insee_com,
      CASE
          WHEN ctwm.nb_postalcodes = 1 THEN ctwm.postalcodes[1]
          WHEN ctwm.nb_postalcodes > 1 THEN bpm."postalCode"
          ELSE NULL
      END AS postal_code,
      CASE
          WHEN ctwm.nb_postalcodes = 1 THEN ctwm."libelleAcheminementWithPostalCodes" ->> ctwm.postalcodes[1]::text
          WHEN ctwm.nb_postalcodes > 1 THEN ctwm."libelleAcheminementWithPostalCodes" ->> bpm."postalCode"::text
          ELSE NULL
      END AS "libelleAcheminement",
      CASE
          WHEN ctwm.nb_postalcodes = 1 THEN 'DATANOVA'
          WHEN ctwm.nb_postalcodes > 1 THEN
              CASE
                  WHEN bpm.intersect_area IS NOT NULL THEN 'CONTOURS_CP'
                  ELSE 'DGFIP'
              END
          ELSE 'DGFIP'
      END AS source_cp
  FROM common_toponym_with_metadata ctwm
  LEFT JOIN best_postal_match bpm 
      ON ctwm.id = bpm.id
  ORDER BY ctwm.id;
`

export const createAddressTempTableQuery = tempTableName => `
  CREATE TEMP TABLE ${tempTableName} AS
  WITH base_address AS (
      SELECT 
          addr.id,
          addr."mainCommonToponymID",
          addr."secondaryCommonToponymIDs",
          addr."districtID",
          addr.number,
          addr.suffix,
          addr.labels,
          addr.certified,
          addr.positions,
          addr."updateDate",
          addr.meta,
          addr.range_validity,
          addr."isActive"
      FROM ban.address addr
      WHERE addr."isActive" 
        AND addr."districtID" = :districtID
  ),
  district_metadata AS (
      SELECT 
          distr.id AS district_id,
          (distr.meta -> 'insee'::text) ->> 'cog'::text AS insee_com
      FROM ban.district distr
  ),
  address_with_metadata AS (
      SELECT 
          ba.*,
          dm.insee_com
      FROM base_address ba
      LEFT JOIN district_metadata dm ON ba."districtID" = dm.district_id
  ),
  address_enriched AS (
      SELECT 
          awm.*,
          dn."postalCodes" AS postalcodes,
          array_length(dn."postalCodes", 1) AS nb_postalcodes,
          dn."libelleAcheminementWithPostalCodes"
      FROM address_with_metadata awm
      LEFT JOIN external.datanova dn 
          ON awm.insee_com = dn."inseeCom"::text
  ),
  address_with_bbox AS (
      SELECT 
          ae.*,
          st_transform(
              st_buffer(
                  st_transform(
                      st_envelope(
                          st_setsrid(
                              st_geomfromgeojson(ae.positions[1] -> 'geometry'::text),
                              4326
                          )
                      ),
                      2154
                  ),
                  10::double precision,
                  'join=mitre endcap=square'::text
              ),
              4326
          ) AS bbox
      FROM address_enriched ae
  ),
  postal_matches AS (
      SELECT 
          aab.id,
          aab.insee_com,
          pa."postalCode",
          pa."inseeCom",
          pa.geometry,
          st_area(
              st_intersection(
                  st_transform(aab.bbox, 2154),
                  st_transform(pa.geometry, 2154)
              )
          ) AS intersect_area
      FROM address_with_bbox aab
      JOIN external.postal_area pa 
          ON aab.insee_com = pa."inseeCom"::text
      WHERE st_intersects(
          st_transform(aab.bbox, 2154),
          st_transform(pa.geometry, 2154)
      )
  ),
  ranked_postal_matches AS (
      SELECT 
          pm.id,
          pm."postalCode",
          pm.intersect_area,
          ROW_NUMBER() OVER (PARTITION BY pm.id ORDER BY pm.intersect_area DESC) AS rank
      FROM postal_matches pm
  ),
  best_postal_match AS (
      SELECT 
          id, 
          "postalCode", 
          intersect_area
      FROM ranked_postal_matches
      WHERE rank = 1
  )
  SELECT 
      aab.id,
      aab."mainCommonToponymID",
      aab."secondaryCommonToponymIDs",
      aab."districtID",
      aab.number,
      aab.suffix,
      aab.labels,
      aab.certified,
      aab.positions,
      aab."updateDate",
      aab.meta,
      aab.range_validity,
      aab."isActive",
      aab.bbox,
      CASE
          WHEN aab.nb_postalcodes = 1 THEN aab.postalcodes[1]
          WHEN aab.nb_postalcodes > 1 THEN bpm."postalCode"
          ELSE NULL
      END AS postal_code,
      CASE
          WHEN aab.nb_postalcodes = 1 THEN aab."libelleAcheminementWithPostalCodes" ->> aab.postalcodes[1]::text
          WHEN aab.nb_postalcodes > 1 THEN aab."libelleAcheminementWithPostalCodes" ->> bpm."postalCode"::text
          ELSE NULL
      END AS "libelleAcheminement",
      CASE
          WHEN aab.nb_postalcodes = 1 THEN 'DATANOVA'
          WHEN aab.nb_postalcodes > 1 THEN
              CASE
                  WHEN bpm.intersect_area IS NOT NULL THEN 'CONTOURS_CP'
                  ELSE 'DGFIP'
              END
          ELSE 'DGFIP'
      END AS source_cp
  FROM address_with_bbox aab
  LEFT JOIN best_postal_match bpm ON aab.id = bpm.id
  ORDER BY aab.id;
`

export const pageQuery = tempTableName => `
  SELECT
    *
  FROM
  ${tempTableName}
  OFFSET :offset
  LIMIT :limit
`

export const countQuery = tempTableName => `
  SELECT
    COUNT(*)
  FROM
  ${tempTableName}
`

export const specificCommonToponymTempTableCountQuery = tempTableName => `
  SELECT
    COUNT(*)
  FROM
  ${tempTableName}
  WHERE meta->'bal'->>'isLieuDit' = 'true';
`

export const addressCertifiedTempTableCountQuery = tempTableName => `
  SELECT
    COUNT(*)
  FROM
  ${tempTableName}
  WHERE certified = TRUE;
`
