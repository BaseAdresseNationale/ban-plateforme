'use strict'

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA ban TO "${POSTGRES_BAN_USER}";`)
    // btree_gist : déjà requis / créé par les migrations d’historisation (address_h, district_h, etc.)

    await queryInterface.sequelize.query(`
      CREATE TABLE ban.district_config (
        district_id UUID NOT NULL PRIMARY KEY
          REFERENCES ban.district(id) ON UPDATE CASCADE ON DELETE CASCADE,
        config JSONB,
        range_validity TSTZRANGE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT district_config_range_validity CHECK (NOT ISEMPTY(range_validity))
      );

      CREATE TABLE ban.district_config_h (LIKE ban.district_config);
      ALTER TABLE ban.district_config_h ADD CONSTRAINT district_config_h_district_id_fkey FOREIGN KEY (district_id)
        REFERENCES ban.district (id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION;
      ALTER TABLE ban.district_config_h ADD CONSTRAINT district_config_h_district_id_range_validity_excl EXCLUDE USING gist (
        district_id WITH =,
        range_validity WITH &&);
      CREATE INDEX ON ban.district_config_h (district_id);
      CREATE INDEX ON ban.district_config_h USING GIST (range_validity);
      ALTER TABLE ban.district_config_h ADD CONSTRAINT district_config_h_range_validity_nonempty CHECK (NOT ISEMPTY(range_validity));
    `)

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.historisation_district_config()
        RETURNS trigger LANGUAGE plpgsql AS $BODY$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          NEW.range_validity := tstzrange(CURRENT_TIMESTAMP, NULL);
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          IF NEW.config IS NOT DISTINCT FROM OLD.config THEN
            RETURN NULL;
          END IF;
          IF NEW.district_id IS DISTINCT FROM OLD.district_id THEN
            RAISE EXCEPTION 'table %: mise à jour de district_id interdite', TG_TABLE_NAME USING ERRCODE = '09000';
          END IF;
          IF NEW.range_validity IS DISTINCT FROM OLD.range_validity OR upper(NEW.range_validity) IS NOT NULL THEN
            RAISE EXCEPTION 'table %: range_validity ne peut être modifié que par le trigger', TG_TABLE_NAME USING ERRCODE = '09000';
          END IF;
          OLD.range_validity := tstzrange(lower(OLD.range_validity), CURRENT_TIMESTAMP);
          NEW.range_validity := tstzrange(CURRENT_TIMESTAMP, NULL);
          EXECUTE format('INSERT INTO %I.%I VALUES ($1.*)', TG_TABLE_SCHEMA, TG_TABLE_NAME || '_h') USING OLD;
          RETURN NEW;
        END IF;
        RETURN NEW;
      END
      $BODY$;
    `)

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS ban_9trigger_histo_on_district_config ON ban.district_config;
      CREATE TRIGGER ban_9trigger_histo_on_district_config
        BEFORE INSERT OR UPDATE OF district_id, config, "createdAt", "updatedAt"
        ON ban.district_config
        FOR EACH ROW
        EXECUTE PROCEDURE public.historisation_district_config();
    `)

    await queryInterface.sequelize.query(`
      INSERT INTO ban.district_config (district_id, config, range_validity, "createdAt", "updatedAt")
      SELECT id, config, tstzrange(NOW(), NULL), NOW(), NOW()
      FROM ban.district
      WHERE config IS NOT NULL
      ON CONFLICT (district_id) DO NOTHING;
    `)

    await queryInterface.sequelize.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ban.district_config TO "${POSTGRES_BAN_USER}";`
    )
    await queryInterface.sequelize.query(
      `GRANT SELECT, INSERT ON TABLE ban.district_config_h TO "${POSTGRES_BAN_USER}";`
    )
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE ban.district d SET config = dc.config
      FROM ban.district_config dc WHERE d.id = dc.district_id;
    `)
    await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS ban_9trigger_histo_on_district_config ON ban.district_config;')
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS public.historisation_district_config();')
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.district_config_h CASCADE;')
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.district_config CASCADE;')
  },
}
