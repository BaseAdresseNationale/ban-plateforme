-- ============================================================
-- Migration: Add indexes for diff functions performance
-- Schema: ban
-- ============================================================

-- ------------------------------------------------------------
-- 1️⃣ RANGE (courant) — accélère les filtres lower(range_validity)
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS address_lower_range_idx
  ON ban.address (lower(range_validity));

CREATE INDEX IF NOT EXISTS common_toponym_lower_range_idx
  ON ban.common_toponym (lower(range_validity));

CREATE INDEX IF NOT EXISTS district_lower_range_idx
  ON ban.district (lower(range_validity));


-- ------------------------------------------------------------
-- 2️⃣ RANGE + district (courant)
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS address_district_lower_range_idx
  ON ban.address ("districtID", lower(range_validity));

CREATE INDEX IF NOT EXISTS common_toponym_district_lower_range_idx
  ON ban.common_toponym ("districtID", lower(range_validity));


-- ------------------------------------------------------------
-- 3️⃣ HISTORIQUE — filtres simples
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS address_h_district_id_idx
  ON ban.address_h
  USING btree ("districtID");

CREATE INDEX IF NOT EXISTS address_h_main_common_toponym_id_idx
  ON ban.address_h
  USING btree ("mainCommonToponymID");

CREATE INDEX IF NOT EXISTS common_toponym_h_district_id_idx
  ON ban.common_toponym_h
  USING btree ("districtID");

-- Historique common_toponym : filtrage par fenêtre temporelle
CREATE INDEX IF NOT EXISTS common_toponym_h_range_validity_idx
  ON ban.common_toponym_h
  USING gist (range_validity);


-- ------------------------------------------------------------
-- 4️⃣ HISTORIQUE — GIST combiné (clé + range)
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS address_h_district_range_gist
  ON ban.address_h
  USING gist ("districtID", range_validity);

CREATE INDEX IF NOT EXISTS address_h_mainct_range_gist
  ON ban.address_h
  USING gist ("mainCommonToponymID", range_validity);

CREATE INDEX IF NOT EXISTS common_toponym_h_district_range_gist
  ON ban.common_toponym_h
  USING gist ("districtID", range_validity);


-- ------------------------------------------------------------
-- 5️⃣ GIN (array filters)
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS address_secondary_common_toponym_ids_gin
  ON ban.address
  USING gin ("secondaryCommonToponymIDs");

CREATE INDEX IF NOT EXISTS address_h_secondary_common_toponym_ids_gin
  ON ban.address_h
  USING gin ("secondaryCommonToponymIDs");


-- ------------------------------------------------------------
-- 6️⃣ DISTRICT meta filters
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS district_cog_idx
  ON ban.district ((meta->'insee'->>'cog'));

CREATE INDEX IF NOT EXISTS district_dept_code_idx
  ON ban.district ((
    CASE
      WHEN left(meta->'insee'->>'cog', 2) IN ('97','98')
        THEN left(meta->'insee'->>'cog', 3)
      ELSE left(meta->'insee'->>'cog', 2)
    END
  ));


-- ------------------------------------------------------------
-- 7️⃣ ANALYZE (important après ajout massif d’index)
-- ------------------------------------------------------------

ANALYZE ban.address;
ANALYZE ban.address_h;
ANALYZE ban.common_toponym;
ANALYZE ban.common_toponym_h;
ANALYZE ban.district;
ANALYZE ban.district_h;
