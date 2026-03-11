import { z } from 'zod';
import { getUUIDv4 } from '@ban/tools';

import { label, banID, pgDateString } from '../ban-generic.shema.js';

const supportedBalLangs = [
    'fra',
] as const;

const balLangSchema = z.enum(supportedBalLangs);

export const districtConfigSchema = z.object({
    certificate: z.record(z.any()).optional(),
    defaultBalLang: balLangSchema.optional(),
});

export const districtInseeMetaSchema = z.object({
    cog: z.string(),
    mainCog: z.string(),
    isMain: z.boolean(),
    mainId: banID,
});

export const districtMetaSchema = z.object({
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
    updateDate: pgDateString.default(() => new Date()),
});
