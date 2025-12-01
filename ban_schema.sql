-- =========================================================
-- BAN schema (dev) - header
-- Extensions + fonctions nécessaires avant d'appliquer le
-- schéma 'ban' dumpé depuis la prod.
-- =========================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Fonction d'historisation utilisée par les triggers BAN
-- (collée depuis historisation.sql)
-- =========[ début historisation.sql ]=========
CREATE OR REPLACE FUNCTION public.historisation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
-- =========[ fin historisation.sql ]===========

-- =========================================================
-- BAN schema dump (schéma = ban)
-- (contenu original de ban_schema.raw.sql)
-- =========================================================

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.1 (Debian 16.1-1.pgdg120+1)
-- Dumped by pg_dump version 16.1 (Debian 16.1-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ban; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ban;


--
-- Name: enum_revisions_status; Type: TYPE; Schema: ban; Owner: -
--

CREATE TYPE ban.enum_revisions_status AS ENUM (
    'success',
    'error',
    'warning',
    'info'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: action; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.action (
    id uuid NOT NULL,
    "districtID" uuid NOT NULL,
    status boolean NOT NULL,
    label character varying(255) NOT NULL,
    siren character varying(255) NOT NULL,
    "sessionID" uuid NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: address; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.address (
    id uuid NOT NULL,
    "mainCommonToponymID" uuid NOT NULL,
    "secondaryCommonToponymIDs" uuid[],
    "districtID" uuid NOT NULL,
    number integer NOT NULL,
    suffix character varying(255),
    labels jsonb[],
    certified boolean,
    positions jsonb[] NOT NULL,
    "updateDate" timestamp with time zone,
    meta jsonb,
    range_validity tstzrange NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    CONSTRAINT range_validity CHECK ((isempty(range_validity) IS FALSE))
);


--
-- Name: address_h; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.address_h (
    id uuid NOT NULL,
    "mainCommonToponymID" uuid NOT NULL,
    "secondaryCommonToponymIDs" uuid[],
    "districtID" uuid NOT NULL,
    number integer NOT NULL,
    suffix character varying(255),
    labels jsonb[],
    certified boolean,
    positions jsonb[] NOT NULL,
    "updateDate" timestamp with time zone,
    meta jsonb,
    range_validity tstzrange NOT NULL,
    "isActive" boolean NOT NULL,
    CONSTRAINT range_validity CHECK ((isempty(range_validity) IS FALSE))
);


--
-- Name: certificate; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.certificate (
    id uuid NOT NULL,
    address_id uuid NOT NULL,
    full_address jsonb NOT NULL,
    cadastre_ids character varying(255)[],
    "createdAt" timestamp with time zone
);


--
-- Name: common_toponym; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.common_toponym (
    id uuid NOT NULL,
    "districtID" uuid NOT NULL,
    labels jsonb[] NOT NULL,
    geometry jsonb,
    "updateDate" timestamp with time zone,
    meta jsonb,
    range_validity tstzrange NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    CONSTRAINT range_validity CHECK ((isempty(range_validity) IS FALSE))
);


--
-- Name: common_toponym_h; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.common_toponym_h (
    id uuid NOT NULL,
    "districtID" uuid NOT NULL,
    labels jsonb[] NOT NULL,
    geometry jsonb,
    "updateDate" timestamp with time zone,
    meta jsonb,
    range_validity tstzrange NOT NULL,
    "isActive" boolean NOT NULL,
    CONSTRAINT range_validity CHECK ((isempty(range_validity) IS FALSE))
);


--
-- Name: district; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.district (
    id uuid NOT NULL,
    labels jsonb[] NOT NULL,
    "updateDate" timestamp with time zone NOT NULL,
    config jsonb,
    meta jsonb,
    range_validity tstzrange NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    CONSTRAINT range_validity CHECK ((isempty(range_validity) IS FALSE))
);


--
-- Name: district_h; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.district_h (
    id uuid NOT NULL,
    labels jsonb[] NOT NULL,
    "updateDate" timestamp with time zone NOT NULL,
    config jsonb,
    meta jsonb,
    range_validity tstzrange NOT NULL,
    "isActive" boolean NOT NULL,
    CONSTRAINT range_validity CHECK ((isempty(range_validity) IS FALSE))
);


--
-- Name: job_status; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.job_status (
    id character varying(255) NOT NULL,
    status character varying(255),
    "dataType" character varying(255),
    "jobType" character varying(255),
    count integer,
    message character varying(255),
    report jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: revisions; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.revisions (
    id uuid NOT NULL,
    "revisionId" character varying(255) NOT NULL,
    cog character varying(5) NOT NULL,
    "districtName" character varying(100),
    "districtId" uuid,
    status ban.enum_revisions_status NOT NULL,
    message text,
    "createdAt" timestamp with time zone NOT NULL
);


--
-- Name: COLUMN revisions.id; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.revisions.id IS 'ID technique de la ligne';


--
-- Name: COLUMN revisions."revisionId"; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.revisions."revisionId" IS 'ID de la révision du dump-api';


--
-- Name: COLUMN revisions.cog; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.revisions.cog IS 'Code commune (COG)';


--
-- Name: COLUMN revisions."districtName"; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.revisions."districtName" IS 'Nom de la commune';


--
-- Name: COLUMN revisions."districtId"; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.revisions."districtId" IS 'ID du district BAN';


--
-- Name: COLUMN revisions.status; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.revisions.status IS 'Statut de traitement';


--
-- Name: COLUMN revisions.message; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.revisions.message IS 'Message brut complet';


--
-- Name: session; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.session (
    id uuid NOT NULL,
    sub character varying(255) NOT NULL,
    name character varying(255),
    "givenName" character varying(255),
    "familyName" character varying(255),
    "usualName" character varying(255),
    email character varying(255) NOT NULL,
    siret character varying(255) NOT NULL,
    aud character varying(255) NOT NULL,
    exp bigint NOT NULL,
    iat bigint NOT NULL,
    iss character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: subscribers; Type: TABLE; Schema: ban; Owner: -
--

CREATE TABLE ban.subscribers (
    id uuid NOT NULL,
    "subscriptionName" character varying(255),
    "webhookUrl" character varying(500) NOT NULL,
    "districtsToFollow" character varying(255)[] DEFAULT (ARRAY[]::character varying[])::character varying(255)[] NOT NULL,
    "statusesToFollow" character varying(255)[] DEFAULT ARRAY['error'::character varying(255), 'warning'::character varying(255)] NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdBy" character varying(255),
    "createdByEmail" character varying(255),
    "createdAt" timestamp with time zone NOT NULL
);


--
-- Name: COLUMN subscribers."subscriptionName"; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.subscribers."subscriptionName" IS 'Nom optionnel donné par l''utilisateur';


--
-- Name: COLUMN subscribers."webhookUrl"; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.subscribers."webhookUrl" IS 'URL de réception des webhooks';


--
-- Name: COLUMN subscribers."districtsToFollow"; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.subscribers."districtsToFollow" IS 'Codes commune à suivre (vide = toutes)';


--
-- Name: COLUMN subscribers."statusesToFollow"; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.subscribers."statusesToFollow" IS 'Statuts à suivre';


--
-- Name: COLUMN subscribers."createdBy"; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.subscribers."createdBy" IS 'sub utilisateur (optionnel)';


--
-- Name: COLUMN subscribers."createdByEmail"; Type: COMMENT; Schema: ban; Owner: -
--

COMMENT ON COLUMN ban.subscribers."createdByEmail" IS 'email utilisateur (optionnel)';


--
-- Name: action action_pkey; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.action
    ADD CONSTRAINT action_pkey PRIMARY KEY (id);


--
-- Name: address address_pkey; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.address
    ADD CONSTRAINT address_pkey PRIMARY KEY (id);


--
-- Name: address_h adresse_h_id_range_validity_excl; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.address_h
    ADD CONSTRAINT adresse_h_id_range_validity_excl EXCLUDE USING gist (id WITH =, range_validity WITH &&);


--
-- Name: certificate certificate_pkey; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.certificate
    ADD CONSTRAINT certificate_pkey PRIMARY KEY (id);


--
-- Name: common_toponym_h common_toponym_h_id_range_validity_excl; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.common_toponym_h
    ADD CONSTRAINT common_toponym_h_id_range_validity_excl EXCLUDE USING gist (id WITH =, range_validity WITH &&);


--
-- Name: common_toponym common_toponym_pkey; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.common_toponym
    ADD CONSTRAINT common_toponym_pkey PRIMARY KEY (id);


--
-- Name: district_h district_h_id_range_validity_excl; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.district_h
    ADD CONSTRAINT district_h_id_range_validity_excl EXCLUDE USING gist (id WITH =, range_validity WITH &&);


--
-- Name: district district_pkey; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.district
    ADD CONSTRAINT district_pkey PRIMARY KEY (id);


--
-- Name: job_status job_status_pkey; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.job_status
    ADD CONSTRAINT job_status_pkey PRIMARY KEY (id);


--
-- Name: revisions revisions_pkey; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.revisions
    ADD CONSTRAINT revisions_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: subscribers subscribers_pkey; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.subscribers
    ADD CONSTRAINT subscribers_pkey PRIMARY KEY (id);


--
-- Name: subscribers subscribers_webhookUrl_key; Type: CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.subscribers
    ADD CONSTRAINT "subscribers_webhookUrl_key" UNIQUE ("webhookUrl");


--
-- Name: address_certified; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX address_certified ON ban.address USING btree (certified);


--
-- Name: address_district_i_d; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX address_district_i_d ON ban.address USING btree ("districtID");


--
-- Name: address_h_id_idx; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX address_h_id_idx ON ban.address_h USING btree (id);


--
-- Name: address_h_range_validity_idx; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX address_h_range_validity_idx ON ban.address_h USING gist (range_validity);


--
-- Name: address_main_common_toponym_i_d; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX address_main_common_toponym_i_d ON ban.address USING btree ("mainCommonToponymID");


--
-- Name: address_secondary_common_toponym_i_ds; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX address_secondary_common_toponym_i_ds ON ban.address USING btree ("secondaryCommonToponymIDs");


--
-- Name: common_toponym_district_i_d; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX common_toponym_district_i_d ON ban.common_toponym USING btree ("districtID");


--
-- Name: common_toponym_h_id_idx; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX common_toponym_h_id_idx ON ban.common_toponym_h USING btree (id);


--
-- Name: common_toponym_h_range_validity_idx; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX common_toponym_h_range_validity_idx ON ban.common_toponym_h USING gist (range_validity);


--
-- Name: district_h_id_idx; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX district_h_id_idx ON ban.district_h USING btree (id);


--
-- Name: district_h_range_validity_idx; Type: INDEX; Schema: ban; Owner: -
--

CREATE INDEX district_h_range_validity_idx ON ban.district_h USING gist (range_validity);


--
-- Name: address ban_9trigger_histo_on_adress; Type: TRIGGER; Schema: ban; Owner: -
--

CREATE TRIGGER ban_9trigger_histo_on_adress BEFORE INSERT OR UPDATE OF id, "mainCommonToponymID", "secondaryCommonToponymIDs", "districtID", number, suffix, labels, certified, positions, "updateDate", meta, "isActive" ON ban.address FOR EACH ROW EXECUTE FUNCTION public.historisation();


--
-- Name: common_toponym ban_9trigger_histo_on_ct; Type: TRIGGER; Schema: ban; Owner: -
--

CREATE TRIGGER ban_9trigger_histo_on_ct BEFORE INSERT OR UPDATE OF id, "districtID", labels, geometry, "updateDate", meta, "isActive" ON ban.common_toponym FOR EACH ROW EXECUTE FUNCTION public.historisation();


--
-- Name: district ban_9trigger_histo_on_district; Type: TRIGGER; Schema: ban; Owner: -
--

CREATE TRIGGER ban_9trigger_histo_on_district BEFORE INSERT OR UPDATE OF id, labels, "updateDate", config, meta, "isActive" ON ban.district FOR EACH ROW EXECUTE FUNCTION public.historisation();


--
-- Name: action action_districtID_fkey; Type: FK CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.action
    ADD CONSTRAINT "action_districtID_fkey" FOREIGN KEY ("districtID") REFERENCES ban.district(id);


--
-- Name: action action_sessionID_fkey; Type: FK CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.action
    ADD CONSTRAINT "action_sessionID_fkey" FOREIGN KEY ("sessionID") REFERENCES ban.session(id);


--
-- Name: address address_districtID_fkey; Type: FK CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.address
    ADD CONSTRAINT "address_districtID_fkey" FOREIGN KEY ("districtID") REFERENCES ban.district(id);


--
-- Name: address address_mainCommonToponymID_fkey; Type: FK CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.address
    ADD CONSTRAINT "address_mainCommonToponymID_fkey" FOREIGN KEY ("mainCommonToponymID") REFERENCES ban.common_toponym(id);


--
-- Name: address_h adresse_h_id_fkey; Type: FK CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.address_h
    ADD CONSTRAINT adresse_h_id_fkey FOREIGN KEY (id) REFERENCES ban.address(id);


--
-- Name: certificate certificate_address_id_fkey; Type: FK CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.certificate
    ADD CONSTRAINT certificate_address_id_fkey FOREIGN KEY (address_id) REFERENCES ban.address(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: common_toponym common_toponym_districtID_fkey; Type: FK CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.common_toponym
    ADD CONSTRAINT "common_toponym_districtID_fkey" FOREIGN KEY ("districtID") REFERENCES ban.district(id);


--
-- Name: common_toponym_h common_toponym_h_id_fkey; Type: FK CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.common_toponym_h
    ADD CONSTRAINT common_toponym_h_id_fkey FOREIGN KEY (id) REFERENCES ban.common_toponym(id);


--
-- Name: district_h district_h_id_fkey; Type: FK CONSTRAINT; Schema: ban; Owner: -
--

ALTER TABLE ONLY ban.district_h
    ADD CONSTRAINT district_h_id_fkey FOREIGN KEY (id) REFERENCES ban.district(id);


--
-- PostgreSQL database dump complete
--

