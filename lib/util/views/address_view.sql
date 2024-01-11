CREATE OR REPLACE VIEW ban.address_with_meta AS
    SELECT
      a.id,
      a."districtID",
      a."mainCommonToponymID",
      a."secondaryCommonToponymIDs",
      a.labels,
      a.number,
      a.suffix,
      a.positions,
      a.certified,
      COALESCE(a.meta, jsonb ('{}')) || 
      COALESCE(jsonb ('{"ban": {"bbox": ' ||
        ST_AsGeoJSON(ST_Transform(ST_Buffer(ST_Transform(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON((a.positions[1])->'geometry'), 4326)), 2154), 50, 'join=mitre endcap=square'), 4326)) || '}}'),
        jsonb ('{}')
      ) ||      
      jsonb ('{"insee": {"cog": ' || (d.meta->'insee'->>'cog') || '}}') ||
      COALESCE(jsonb ('{"laPoste": {"libelleAcheminement": ' || (d.meta->'laPoste'->'libelleAcheminement')::text ||
      COALESCE(
        ', "codePostal" : ' ||
        CASE JSONB_ARRAY_LENGTH(d.meta->'laPoste'->'codePostal')
          WHEN '1' THEN (d.meta->'laPoste'->'codePostal')[0]::text || ', "source": "La Poste - dataNOVA"'
          ELSE
              COALESCE(
                cp."codePostal",
                (
                  SELECT cp2."codePostal"
                  FROM external.contours_postaux AS cp2
                  WHERE (d.meta->'insee')->> 'cog' LIKE cp2.cog
                  ORDER BY ST_Distance(
                    ST_GeomFromGeoJSON((a.positions[1])->'geometry'),
                    cp2.geom)
                  LIMIT 1
                )
              )::text || ', "source": "La Poste - contours postaux"'
        END
        || '}}',
        '}}')
      ), jsonb('{}')) AS meta,
      a."updateDate"
    FROM ban.address AS a
    JOIN ban.district AS d
    ON a."districtID" = d.id
    LEFT JOIN external.contours_postaux AS cp
    ON (d.meta->'insee')->> 'cog' LIKE cp.cog AND ST_Within(ST_GeomFromGeoJSON((a.positions[1])->'geometry'), cp.geom)