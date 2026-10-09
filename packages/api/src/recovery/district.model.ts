import { z } from 'zod';
import { getUUIDv4 } from '@ban/tools';

import { label, banID, pgDateString } from '../api/ban-generic.shema.js';

const districtConfigSchema = z.object({
    certificate: z.record(z.any()).optional(),
    defaultBalLang: z.string().optional(), // TODO: Enum of supported languages?
});

const districtInseeMetaSchema = z.object({
    cog: z.string(),
    mainCog: z.string(),
    isMain: z.boolean(),
    mainId: banID,
});

const districtMetaSchema = z.object({
    insee: districtInseeMetaSchema.optional(),
    bal: z.record(z.any()).optional(),
});

export const banDistrictSchema = z.object({
    id: banID.default(getUUIDv4),
    labels: z.array(label).default([]),
    config: districtConfigSchema.optional().default({}),
    meta: districtMetaSchema.optional().default({}),
    isActive: z.boolean().optional().default(true),
});

export const banPgDistrictSchema = banDistrictSchema.extend({
    // updateDate: pgDateString.default(() => new Date().toISOString()),
    updateDate: pgDateString.default(() => new Date()),
});

export type DistrictCertificate = z.infer<typeof districtConfigSchema>['certificate'];
export type DistrictConfig = z.infer<typeof districtConfigSchema>;
export type DistrictInseeMeta = z.infer<typeof districtInseeMetaSchema>;
export type DistrictMeta = z.infer<typeof districtMetaSchema>;
export type GenericDistrict = z.infer<typeof banDistrictSchema>;
export type BanDistrict = GenericDistrict;
export type BanPgDistrict = z.infer<typeof banPgDistrictSchema>;
