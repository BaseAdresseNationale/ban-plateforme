-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ban";

-- CreateEnum
CREATE TYPE "enum_revisions_status" AS ENUM ('success', 'error', 'warning', 'info');

-- CreateTable
CREATE TABLE "action" (
    "id" UUID NOT NULL,
    "districtID" UUID NOT NULL,
    "status" BOOLEAN NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "siren" VARCHAR(255) NOT NULL,
    "sessionID" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address" (
    "id" UUID NOT NULL,
    "mainCommonToponymID" UUID NOT NULL,
    "secondaryCommonToponymIDs" UUID[],
    "districtID" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "suffix" VARCHAR(255),
    "labels" JSONB[],
    "certified" BOOLEAN,
    "positions" JSONB[],
    "updateDate" TIMESTAMPTZ(6),
    "meta" JSONB,
    "range_validity" tstzrange,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_h" (
    "id" UUID NOT NULL,
    "mainCommonToponymID" UUID NOT NULL,
    "secondaryCommonToponymIDs" UUID[],
    "districtID" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "suffix" VARCHAR(255),
    "labels" JSONB[],
    "certified" BOOLEAN,
    "positions" JSONB[],
    "updateDate" TIMESTAMPTZ(6),
    "meta" JSONB,
    "range_validity" tstzrange NOT NULL,
    "isActive" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "certificate" (
    "id" UUID NOT NULL,
    "address_id" UUID NOT NULL,
    "full_address" JSONB NOT NULL,
    "cadastre_ids" VARCHAR(255)[],
    "createdAt" TIMESTAMPTZ(6),

    CONSTRAINT "certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "common_toponym" (
    "id" UUID NOT NULL,
    "districtID" UUID NOT NULL,
    "labels" JSONB[],
    "geometry" JSONB,
    "updateDate" TIMESTAMPTZ(6),
    "meta" JSONB,
    "range_validity" tstzrange,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "common_toponym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "common_toponym_h" (
    "id" UUID NOT NULL,
    "districtID" UUID NOT NULL,
    "labels" JSONB[],
    "geometry" JSONB,
    "updateDate" TIMESTAMPTZ(6),
    "meta" JSONB,
    "range_validity" tstzrange NOT NULL,
    "isActive" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "district" (
    "id" UUID NOT NULL,
    "labels" JSONB[],
    "updateDate" TIMESTAMPTZ(6) NOT NULL,
    "config" JSONB,
    "meta" JSONB,
    "range_validity" tstzrange,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "district_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "district_h" (
    "id" UUID NOT NULL,
    "labels" JSONB[],
    "updateDate" TIMESTAMPTZ(6) NOT NULL,
    "config" JSONB,
    "meta" JSONB,
    "range_validity" tstzrange NOT NULL,
    "isActive" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "job_status" (
    "id" VARCHAR(255) NOT NULL,
    "status" VARCHAR(255),
    "dataType" VARCHAR(255),
    "jobType" VARCHAR(255),
    "count" INTEGER,
    "message" VARCHAR(255),
    "report" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisions" (
    "id" UUID NOT NULL,
    "revisionId" VARCHAR(255) NOT NULL,
    "cog" VARCHAR(5) NOT NULL,
    "districtName" VARCHAR(100),
    "districtId" UUID,
    "status" "enum_revisions_status" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "sub" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "givenName" VARCHAR(255),
    "familyName" VARCHAR(255),
    "usualName" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    "siret" VARCHAR(255) NOT NULL,
    "aud" VARCHAR(255) NOT NULL,
    "exp" BIGINT NOT NULL,
    "iat" BIGINT NOT NULL,
    "iss" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" UUID NOT NULL,
    "subscriptionName" VARCHAR(255),
    "webhookUrl" VARCHAR(500) NOT NULL,
    "districtsToFollow" VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR(255)[],
    "statusesToFollow" VARCHAR(255)[] DEFAULT ARRAY['error', 'warning']::VARCHAR(255)[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" VARCHAR(255),
    "createdByEmail" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "address_certified" ON "address"("certified");

-- CreateIndex
CREATE INDEX "address_district_i_d" ON "address"("districtID");

-- CreateIndex
CREATE INDEX "address_main_common_toponym_i_d" ON "address"("mainCommonToponymID");

-- CreateIndex
CREATE INDEX "address_secondary_common_toponym_i_ds" ON "address"("secondaryCommonToponymIDs");

-- CreateIndex
CREATE INDEX "address_h_id_idx" ON "address_h"("id");

-- CreateIndex
CREATE INDEX "address_h_range_validity_idx" ON "address_h" USING GIST ("range_validity");

-- CreateIndex
CREATE INDEX "common_toponym_district_i_d" ON "common_toponym"("districtID");

-- CreateIndex
CREATE INDEX "common_toponym_h_id_idx" ON "common_toponym_h"("id");

-- CreateIndex
CREATE INDEX "common_toponym_h_range_validity_idx" ON "common_toponym_h" USING GIST ("range_validity");

-- CreateIndex
CREATE INDEX "district_h_id_idx" ON "district_h"("id");

-- CreateIndex
CREATE INDEX "district_h_range_validity_idx" ON "district_h" USING GIST ("range_validity");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_webhookUrl_key" ON "subscribers"("webhookUrl");

-- AddForeignKey
ALTER TABLE "action" ADD CONSTRAINT "action_districtID_fkey" FOREIGN KEY ("districtID") REFERENCES "district"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "action" ADD CONSTRAINT "action_sessionID_fkey" FOREIGN KEY ("sessionID") REFERENCES "session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_districtID_fkey" FOREIGN KEY ("districtID") REFERENCES "district"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_mainCommonToponymID_fkey" FOREIGN KEY ("mainCommonToponymID") REFERENCES "common_toponym"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "address_h" ADD CONSTRAINT "adresse_h_id_fkey" FOREIGN KEY ("id") REFERENCES "address"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "common_toponym" ADD CONSTRAINT "common_toponym_districtID_fkey" FOREIGN KEY ("districtID") REFERENCES "district"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "common_toponym_h" ADD CONSTRAINT "common_toponym_h_id_fkey" FOREIGN KEY ("id") REFERENCES "common_toponym"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "district_h" ADD CONSTRAINT "district_h_id_fkey" FOREIGN KEY ("id") REFERENCES "district"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
