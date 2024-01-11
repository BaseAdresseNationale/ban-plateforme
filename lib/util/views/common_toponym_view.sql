CREATE OR REPLACE VIEW ban.common_toponym_with_meta AS
    SELECT
      ct.id,
      ct."districtID",
      ct.labels,
      ct.geometry,
      COALESCE(ct.meta, jsonb('{}')) ||
      COALESCE(jsonb ('{"ban": {"centroid": ' || (
        SELECT ST_AsGeoJSON(ST_Centroid(ST_Collect(ST_GeomFromGeoJSON((a.positions[1])->'geometry'))))
        FROM ban.address AS a
        WHERE ct.id = a."mainCommonToponymID" OR ct.id = ANY(a."secondaryCommonToponymIDs")
      ) || ', "addressBbox": ' || (
        SELECT ST_AsGeoJSON(ST_Transform(ST_Buffer(ST_Transform(ST_Envelope(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((a.positions[1])->'geometry'), 4326))), 2154), 200, 'join=mitre endcap=square'), 4326))
        FROM ban.address_with_meta AS a
        WHERE ct.id = a."mainCommonToponymID" OR ct.id = ANY(a."secondaryCommonToponymIDs")
      ) || COALESCE(', "bbox": ' ||
        ST_AsGeoJSON(ST_Transform(ST_Buffer(ST_Transform(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON(ct.geometry), 4326)), 2154), 100, 'join=mitre endcap=square'), 4326)),
        '')
      || '}}'), jsonb('{}')) ||
      jsonb ('{"insee": {"cog": ' || (d.meta->'insee'->>'cog') || '}}') ||
      COALESCE(jsonb (
        '{"laPoste": {"libelleAcheminement": ' || (d.meta->'laPoste'->'libelleAcheminement')::text ||
        COALESCE(
          ', "codePostal" : ' ||
          (
            SELECT REPLACE(REPLACE((ARRAY_AGG(DISTINCT (a.meta->'laPoste')->> 'codePostal'))::text, '{', '['), '}', ']')
            FROM ban.address_with_meta AS a
            WHERE (ct.id = a."mainCommonToponymID" OR ct.id = ANY(a."secondaryCommonToponymIDs")) AND a.meta->'laPoste'->'codePostal' IS NOT NULL
          ) || ', "source": ' ||
          (
            SELECT a.meta->'laPoste'->'source'::text
            FROM ban.address_with_meta AS a
            WHERE (ct.id = a."mainCommonToponymID" OR ct.id = ANY(a."secondaryCommonToponymIDs")) AND a.meta->'laPoste'->'source' IS NOT NULL
            LIMIT 1
          ),
          ''
        ) || '}}'
      ), jsonb('{}')) AS meta,
      ct."updateDate"
    FROM ban.common_toponym AS ct
    JOIN ban.district AS d
    ON d.id = ct."districtID"