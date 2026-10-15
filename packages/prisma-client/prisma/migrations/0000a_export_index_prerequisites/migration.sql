-- Prérequis des indexes de 0001, également sur une base vide ou restaurée.
-- Le nom place ce fichier après 0000_baseline et avant 0001, sans réécriture.
BEGIN;
SET LOCAL search_path = ban, public;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

-- Cet index de la baseline peut être absent d'un dump de production.
CREATE INDEX IF NOT EXISTS address_h_range_validity_idx
  ON ban.address_h USING gist (range_validity);

ANALYZE ban.address_h;
COMMIT;
