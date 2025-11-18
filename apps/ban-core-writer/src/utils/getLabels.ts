import type { BalAdresse, MultilingualBalKey } from '@ban/types';
import type { LangISO639v3 } from '@ban/types';

export const DEFAULT_ISO_LANG = 'fra';

const getLabels = (
    balAdresse: BalAdresse,
    keyLabel: keyof BalAdresse,
    defaultIsoLang: LangISO639v3 = DEFAULT_ISO_LANG
): Record<LangISO639v3, string> => {

    const isoCodeFromKeyLabel = (key: string) => key.startsWith(`${keyLabel}_`) ? key.replace(RegExp(`^${keyLabel}_`), '') : undefined;

    const baseValue = balAdresse[keyLabel];
    return {
        [defaultIsoLang as LangISO639v3]: baseValue ? String(baseValue) : '',
        ...Object.fromEntries(
            (Object.keys(balAdresse).filter((key) => key.startsWith(`${keyLabel}_`) && Number(isoCodeFromKeyLabel(key)?.length) === 3) as MultilingualBalKey[])
                .filter((key) => {
                    const val = balAdresse[key];
                    return typeof val === 'string' && val.trim() !== '';
                })
                .map((key) => [isoCodeFromKeyLabel(key), String(balAdresse[key])])
        ),
    }
}

export default getLabels;
