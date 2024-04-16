'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.address ALTER COLUMN range_validity DROP DEFAULT;
        ALTER TABLE ban.address ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE ban.address ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      await queryInterface.sequelize.query(`
        ALTER TABLE ban.common_toponym ALTER COLUMN range_validity DROP DEFAULT;
        ALTER TABLE ban.common_toponym ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE ban.common_toponym ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      await queryInterface.sequelize.query(`
        ALTER TABLE ban.district ALTER COLUMN range_validity DROP DEFAULT;
        ALTER TABLE ban.district ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE ban.district ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

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
                    --s'il n'y a pas de changement, pas d'update et pas d'action dans l'historique, on interrompt l'action du trigger--
                    IF NEW IS NOT DISTINCT FROM OLD THEN
                        RAISE NOTICE  'table %s: id=%  objet sans modification, aucune opération réalisée!', TG_TABLE_NAME,OLD.ID; 
                        RETURN NULL;
                    END IF;
                    -- le changement d'id ne doit pas arriver, au cas où, on renvoie une exception
                    IF NEW.ID IS DISTINCT FROM OLD.ID  THEN
                        RAISE EXCEPTION 'table %s: update sur le champ id de l''objet %s non valide',TG_TABLE_NAME, OLD.ID USING ERRCODE = '09000';
                    END IF;
                    -- le changement du champ range_validity n'est pas autorisé à ce niveau et ne doit être réalisé que par le trigger, on renvoie une exception
                    IF NEW.range_validity IS DISTINCT FROM OLD.range_validity OR upper(NEW.range_validity) IS NOT NULL  THEN
                        RAISE EXCEPTION 'table %s: opération update sur le champ range_validity (valeur upper=%) de l''objet %s non autorisé',TG_TABLE_NAME,NEW.range_validity, OLD.ID USING ERRCODE = '09000';
                    END IF;
                    OLD.range_validity = tstzrange(lower(OLD.range_validity),current_timestamp);
                    NEW.range_validity = tstzrange(current_timestamp,NULL);
              
                    EXECUTE format('INSERT INTO '|| TG_TABLE_SCHEMA  ||'.' || TG_TABLE_NAME || '_h VALUES ($1.*)') USING OLD;
                    RETURN NEW;
                ELSE
                    RETURN NEW;
                END IF;
            END
        $BODY$;
        -----------------TRIGGERS-------------------------------------------
        --exclusion du champ range_validity pour éviter des appels récursifs, ajout du champ id -à priori inutile -mais pour contrôle supplémentaire
        --address
        DROP TRIGGER IF EXISTS ban_9trigger_histo_on_adress  ON ban.address ;
        CREATE TRIGGER ban_9trigger_histo_on_adress BEFORE INSERT OR UPDATE
        OF id, "mainCommonToponymID","secondaryCommonToponymIDs","districtID","number",suffix,labels,certified,positions,"updateDate",meta,"isActive"
        ON ban.address FOR EACH ROW EXECUTE PROCEDURE public.historisation();
        --common_toponym
        DROP TRIGGER IF EXISTS ban_9trigger_histo_on_ct ON ban.common_toponym;
        CREATE TRIGGER ban_9trigger_histo_on_ct BEFORE INSERT OR UPDATE
        OF id, "districtID",labels,geometry,"updateDate",meta,"isActive"
        ON ban.common_toponym FOR EACH ROW EXECUTE PROCEDURE public.historisation();
        --district
        DROP TRIGGER IF EXISTS ban_9trigger_histo_on_district ON ban.district;
        CREATE TRIGGER ban_9trigger_histo_on_district BEFORE INSERT OR UPDATE
        OF id, labels,"updateDate",config,meta,"isActive"
        ON ban.district FOR EACH ROW EXECUTE PROCEDURE public.historisation();
      `)
    } catch (error) {
      console.log(error)
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS ban_9trigger_histo_on_adress  ON ban.address;')
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS ban_9trigger_histo_on_ct ON ban.common_toponym;')
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS ban_9trigger_histo_on_district ON ban.district;')

      await queryInterface.sequelize.query(`
        ALTER TABLE ban.address DROP CONSTRAINT range_validity;
        ALTER TABLE ban.address ALTER COLUMN range_validity DROP NOT NULL;
        ALTER TABLE ban.address ALTER COLUMN range_validity SET DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
      `)
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.common_toponym DROP CONSTRAINT range_validity;
        ALTER TABLE ban.common_toponym ALTER COLUMN range_validity DROP NOT NULL;
        ALTER TABLE ban.common_toponym ALTER COLUMN range_validity SET DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
      `)
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.district DROP CONSTRAINT range_validity;
        ALTER TABLE ban.district ALTER COLUMN range_validity DROP NOT NULL;
        ALTER TABLE ban.district ALTER COLUMN range_validity SET DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
      `)
    } catch (error) {
      console.log(error)
    }
  }
}
