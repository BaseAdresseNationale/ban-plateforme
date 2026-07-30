export const getDepartementCodeFromCog = (cog?: string | null, isTestEnv?: boolean): string | null => {
  if (typeof cog !== 'string') {
    return null;
  }

  const normalizedCog = cog.trim().toUpperCase();
  if (!normalizedCog) {
    return null;
  }

  const departementCode = (normalizedCog.startsWith('97') && normalizedCog.length === 5)
    ? normalizedCog.slice(0, 3)
    : normalizedCog.slice(0, 2);

  if (isTestEnv && departementCode === '96') {
    return '96';
  }

  if (!/^\d{2,3}$/.test(departementCode)) {
    return null;
  }

  return departementCode;
};

const regionConfig: Record<string, {code: string; nom: string; departements: string[]; envTestOnly?: boolean}> = {
  Guadeloupe: { code: '01', nom: 'Guadeloupe', departements: ['971'] },
  Martinique: { code: '02', nom: 'Martinique', departements: ['972'] },
  Guyane: { code: '03', nom: 'Guyane', departements: ['973'] },
  'La Reunion': { code: '04', nom: 'La Reunion', departements: ['974'] },
  Mayotte: { code: '06', nom: 'Mayotte', departements: ['976'] },
  'Ile-de-France': { code: '11', nom: 'Ile-de-France', departements: ['75', '77', '78', '91', '92', '93', '94', '95'] },
  'Centre-Val de Loire': { code: '24', nom: 'Centre-Val de Loire', departements: ['18', '28', '36', '37', '41', '45'] },
  'Bourgogne-Franche-Comte': { code: '27', nom: 'Bourgogne-Franche-Comte', departements: ['21', '25', '39', '58', '70', '71', '89', '90'] },
  Normandie: { code: '28', nom: 'Normandie', departements: ['14', '27', '50', '61', '76'] },
  'Hauts-de-France': { code: '32', nom: 'Hauts-de-France', departements: ['02', '59', '60', '62', '80'] },
  'Grand Est': { code: '44', nom: 'Grand Est', departements: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'] },
  'Pays de la Loire': { code: '52', nom: 'Pays de la Loire', departements: ['44', '49', '53', '72', '85'] },
  Bretagne: { code: '53', nom: 'Bretagne', departements: ['22', '29', '35', '56'] },
  'Nouvelle-Aquitaine': { code: '75', nom: 'Nouvelle-Aquitaine', departements: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'] },
  Occitanie: { code: '76', nom: 'Occitanie', departements: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'] },
  "Provence-Alpes-Cote d'Azur": { code: '93', nom: "Provence-Alpes-Cote d'Azur", departements: ['04', '05', '06', '13', '83', '84'] },
  Corse: { code: '94', nom: 'Corse', departements: ['2A', '2B'] },
  // This region is used for testing purposes only and should not be used in production :
  'Royaumes-Enchantes': { code: '96', nom: 'Royaumes-Enchantes', departements: ['96'], envTestOnly: true },
};

export const getRegionFromDepartementCode = (dep?: string | null, isTestEnv?: boolean): {code: string; nom: string} | null => {
  if (!dep) {
    return null;
  }

  for (const region of Object.values(regionConfig)) {
    if (region.departements.includes(dep)) {
      if (region.envTestOnly && !isTestEnv) {
        continue;
      }

      return { code: region.code, nom: region.nom };
    }
  }

  return null;
};
