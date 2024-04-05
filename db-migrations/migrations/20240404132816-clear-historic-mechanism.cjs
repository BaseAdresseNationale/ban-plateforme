'use strict'

require('dotenv').config()

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
      // Clear trigger and trigger function
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS ban_9trigger_histo_on_adress  ON ban.address;
        DROP TRIGGER IF EXISTS ban_9trigger_histo_on_ct ON ban.common_toponym;
        DROP TRIGGER IF EXISTS ban_9trigger_histo_on_district ON ban.district;
        DROP FUNCTION IF EXISTS public.historisation();
        `)

      // Drop all historic tables
      await queryInterface.sequelize.query(`
        DROP TABLE IF EXISTS ban.address_h;
        DROP TABLE IF EXISTS ban.common_toponym_h;
        DROP TABLE IF EXISTS ban.district_h;
      `)

      // Delete data that was previously "deleted" by the trigger
      await queryInterface.sequelize.query(`
        DELETE FROM ban.address WHERE upper(range_validity) IS NOT NULL;
        DELETE FROM ban.common_toponym WHERE upper(range_validity) IS NOT NULL;
        DELETE FROM ban.district WHERE upper(range_validity) IS NOT NULL;
      `)

      // Drop range_validity on all current tables
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.address DROP COLUMN range_validity;
        ALTER TABLE ban.common_toponym DROP COLUMN range_validity;
        ALTER TABLE ban.district DROP COLUMN range_validity;
      `)

      await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS btree_gist;')
    } catch (error) {
      console.error(error)
    }
  },

  async down(queryInterface) {
    try {
      // Add range_validity column on common_toponym table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.address ADD range_validity tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
        ALTER TABLE ban.address ALTER COLUMN range_validity DROP DEFAULT;
        ALTER TABLE ban.address ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE ban.address ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      // Add range_validity column on common_toponym table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.common_toponym ADD range_validity tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
        ALTER TABLE ban.common_toponym ALTER COLUMN range_validity DROP DEFAULT;
        ALTER TABLE ban.common_toponym ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE ban.common_toponym ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      // Add range_validity column on district table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.district ADD range_validity tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
        ALTER TABLE ban.district ALTER COLUMN range_validity DROP DEFAULT;
        ALTER TABLE ban.district ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE ban.district ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist;')

      // Create address_h historic table
      // the adresse_h_id_range_validity_excl constraint ensures that no two rows have the same id value and overlapping range_validity ranges.
      await queryInterface.sequelize.query(`
        CREATE TABLE ban.address_h (LIKE ban.address);
        ALTER TABLE ban.address_h ADD CONSTRAINT adresse_h_id_fkey FOREIGN KEY (id)
          REFERENCES ban.address (id) MATCH SIMPLE
          ON UPDATE NO ACTION
          ON DELETE NO ACTION;
        ALTER TABLE ban.address_h ADD CONSTRAINT adresse_h_id_range_validity_excl EXCLUDE USING gist (
          id WITH =,
          range_validity WITH &&);
        CREATE INDEX ON  ban.address_h (id);
        CREATE INDEX ON ban.address_h USING GIST (range_validity);
        ALTER TABLE  ban.address_h ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE  ban.address_h ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      // Create common_toponym_h historic table
      // the common_toponym_h_id_range_validity_excl constraint ensures that no two rows have the same id value and overlapping range_validity ranges.
      await queryInterface.sequelize.query(`
        CREATE TABLE ban.common_toponym_h (LIKE ban.common_toponym);
        ALTER TABLE ban.common_toponym_h ADD CONSTRAINT common_toponym_h_id_fkey FOREIGN KEY (id)
          REFERENCES ban.common_toponym (id) MATCH SIMPLE
          ON UPDATE NO ACTION
          ON DELETE NO ACTION;
        ALTER TABLE ban.common_toponym_h ADD CONSTRAINT common_toponym_h_id_range_validity_excl EXCLUDE USING gist (
          id WITH =,
          range_validity WITH &&);
        CREATE INDEX ON  ban.common_toponym_h (id);
        CREATE INDEX ON ban.common_toponym_h USING GIST (range_validity);
        ALTER TABLE  ban.common_toponym_h ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE  ban.common_toponym_h ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      // Create district_h historic table
      // the district_h_id_range_validity_excl constraint ensures that no two rows have the same id value and overlapping range_validity ranges.
      await queryInterface.sequelize.query(`
        CREATE TABLE ban.district_h (LIKE ban.district);
        ALTER TABLE ban.district_h ADD CONSTRAINT district_h_id_fkey FOREIGN KEY (id)
          REFERENCES ban.district (id) MATCH SIMPLE
          ON UPDATE NO ACTION
          ON DELETE NO ACTION;
        ALTER TABLE ban.district_h ADD CONSTRAINT district_h_id_range_validity_excl EXCLUDE USING gist (
          id WITH =,
          range_validity WITH &&);
        CREATE INDEX ON  ban.district_h (id);
        CREATE INDEX ON ban.district_h USING GIST (range_validity);
        ALTER TABLE  ban.district_h ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE  ban.district_h ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)
      // Grant permissions to ban user
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT ON TABLE ban.address_h, ban.common_toponym_h, ban.district_h TO "${POSTGRES_BAN_USER}";`)

      await queryInterface.sequelize.query(`
        --@version 0.02, 2024-02-26
        --@author  IGN
        ------------------ FONCTION TRIGGER-----------------------------------------------------
        CREATE OR REPLACE FUNCTION public.historisation()
            RETURNS trigger
            LANGUAGE 'plpgsql'
        
        AS $BODY$
        
        BEGIN
          IF (TG_OP = 'INSERT') THEN
              NEW.range_validity =  tstzrange(current_timestamp::timestamp,NULL);
            RETURN NEW;
            ELSEIF (TG_OP = 'UPDATE') THEN
                --si il n'y a pas de changement pas d'update et pas action dans historique on interrompt l'action du trigger--
                  IF NEW IS NOT DISTINCT FROM OLD THEN
              RAISE NOTICE  'table %s: id=%  objet sans modification, aucune opération réalisée!', TG_TABLE_NAME,OLD.ID; 
                    RETURN NULL;
                END IF;
                -- le changement d'id ne doit pas arriver, au cas où on renvoie une exception
                IF NEW.ID IS DISTINCT FROM OLD.ID  THEN
                    RAISE EXCEPTION 'table %s: update sur le champ id de l''objet %s non valide',TG_TABLE_NAME, OLD.ID USING ERRCODE = '09000';
                END IF;
            -- le changement du champ date_validity n'est pas autorisé à ce niveau, et ne doit être réalisé que par le trigger, on renvoie une exception
                IF NEW.range_validity IS DISTINCT FROM OLD.range_validity OR upper(NEW.range_validity) IS NOT NULL  THEN
                    RAISE EXCEPTION 'table %s: operation update sur le champ range_validity (valeur upper=%) de l''objet %s non autorisé',TG_TABLE_NAME,NEW.range_validity, OLD.ID USING ERRCODE = '09000';
                END IF;
                --IF upper(NEW.range_validity) is NOT NULL THEN
              --RAISE NOTICE  'table %s: id=%  cas non prévu!', TG_TABLE_NAME,OLD.ID; 										
                    --RETURN NULL;
                --END IF;
                OLD.range_validity = tstzrange(lower(OLD.range_validity),current_timestamp);
            NEW.range_validity = tstzrange(current_timestamp,NULL);
          
                EXECUTE format('INSERT INTO '|| TG_TABLE_SCHEMA  ||'.' || TG_TABLE_NAME || '_h VALUES ($1.*)') USING OLD;
              RETURN NEW;
            ELSEIF (TG_OP = 'DELETE') THEN -- c'est un update sans enregistrement dans l'historique ne doit pas declencher une recursion du trigger
            IF upper(OLD.range_validity) IS NOT NULL THEN -- objet avec date fin de validité anciennement présente, on ne fait rien
              RAISE NOTICE  'table %s: id=%  date de fin de validité déjà présente, aucune opération réalisée!', TG_TABLE_NAME,OLD.ID; 
              RETURN NULL;
            END IF;
          
                EXECUTE format('UPDATE %I.%I SET range_validity=tstzrange(lower(range_validity),current_timestamp) WHERE id=%L;',
            TG_TABLE_SCHEMA,TG_TABLE_NAME,OLD.ID );
                RETURN NULL;
            ELSE
                RETURN NEW;
            END IF;
        END
        $BODY$;
        
        -----------------TRIGGERS-------------------------------------------
        --exclusion du champ date_validity pour eviter appels recursifs, ajout du champ id -à priori inutile -mais pour contrôle supplémentaire
        --address
        DROP TRIGGER IF EXISTS ban_9trigger_histo_on_adress  ON ban.address ;
        CREATE TRIGGER ban_9trigger_histo_on_adress BEFORE INSERT OR DELETE OR UPDATE
        OF id, "mainCommonToponymID","secondaryCommonToponymIDs","districtID","number",suffix,labels,certified,positions,"updateDate",meta
        ON ban.address FOR EACH ROW EXECUTE PROCEDURE public.historisation();
        --common_toponym
        DROP TRIGGER IF EXISTS ban_9trigger_histo_on_ct ON ban.common_toponym;
        CREATE TRIGGER ban_9trigger_histo_on_ct BEFORE INSERT OR DELETE OR UPDATE
        OF id, "districtID",labels,geometry,"updateDate",meta
        ON ban.common_toponym FOR EACH ROW EXECUTE PROCEDURE public.historisation();
        --district
        DROP TRIGGER IF EXISTS ban_9trigger_histo_on_district ON ban.district;
        CREATE TRIGGER ban_9trigger_histo_on_district BEFORE INSERT OR DELETE OR UPDATE
        OF id, labels,"updateDate",config,meta
        ON ban.district FOR EACH ROW EXECUTE PROCEDURE public.historisation();
      `)
    } catch (error) {
      console.error(error)
    }
  }
}
