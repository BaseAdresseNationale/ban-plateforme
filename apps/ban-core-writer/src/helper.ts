type Label = {
  isoCode: string;
  value: string;
};

const getLabelsFromRow = (row: Record<string, any>, defaultIsoCode: string = 'fra') => (colName: string) => {
  const labels: Label[] = row[colName] ? [{ isoCode: defaultIsoCode, value: row[colName] }] : [];
  Object.entries(row).forEach(([key, value]) => {
    if (key.startsWith(`${colName}_`)) {
      const isoCode = key.replace(new RegExp(`^(${colName})_`, 'i'), '');
      labels.push({ isoCode, value });
    }
  });
  return labels;
};

const getItemPositions = (item: Record<string, any> | undefined, row: Record<string, any>) => {
  const position = item?.positions || [];
  position.push({
    type: row.position || 'unknown', // TODO : Convert position name to a standard type if needed
    geometry: {
      type: 'Point',
      system: 'WGS84',
      coordinates: [row.long, row.lat],
      legalMapProjection: {
        system: 'Lambert-93', // TODO: Replace with actual projection if available
        coordinates: [row.x, row.y],
      },
    },
  });
  return position;
};

export const getBanObjectsFromBalRows = (rows: any[], defaultIsoCode: string) => {
  const addresses: Record<string, any> = {};
  const commonToponyms: Record<string, any> = {};
  const districts: Record<string, any> = {};

  rows.forEach((row: any) => {
    const getterLabels = getLabelsFromRow(row, defaultIsoCode);
    // TODO: Gérer les fusions profondes (plusieurs lignes pour une même entité) cf. oldDistrict

    // District
    if (row.id_ban_commune) {
      districts[row.id_ban_commune] = {
        ...districts?.[row.id_ban_commune] || {},
        id: row.id_ban_commune,
        labels: getterLabels('commune_nom') || [],
      };
    }

    // Toponym
    if (row.id_ban_toponyme) {
      commonToponyms[row.id_ban_toponyme] = {
        ...commonToponyms?.[row.id_ban_toponyme] || {},
        id: row.id_ban_toponyme,
        districtID: row.id_ban_commune,
        district: districts[row.id_ban_commune] || {},
        labels: getterLabels('voie_nom') || [],
        // certified: [1, '1', 'oui', 'true', true].includes(row.certification_commune), // TODO: Add certified field if available
        geometry: {
          type: 'Point',
          coordinates: [row.long, row.lat],
        },
        meta: {
          ban: {
            category: row.ban_categorie || 'voie',
            source: row.source || '',
            sourceNomVoie: row.ban_source_nom_voie || '', // TODO: WHAT IS THIS?
            hashIdFix: row.ban_enrich_hash_id_fix || '',
            DEPRECATED_id: '???',
            DEPRECATED_groupId: row.slug || '',
            DEPRECATED_cleInterop: row.cle_interop || '',
            DEPRECATED_cleInteropBAN: row.ban_enrich_deprecated_cle_interop || '',
            targetKey: row.ban_enrich_ban_target_key_toponym || ['']
          },
          dgfip: {
            cadastre: (row.cadastre_parcelles || row.cad_parcelles || null)?.split('|') || [],
            DEPRECATED_codeFantoir: row.ban_enrich_code_fantoir || '',
          },
          insee: {
            cog: row.commune_insee || '',
            mainCog: row.ban_enrich_main_cog || '',
            isMainCog: row.ban_enrich_is_main_cog || '',
          },
          laPoste: {
            codePostal: row.ban_enrich_code_postal ? [row.ban_enrich_code_postal.split('|')] : [],
          },
        },
        legalityDate: row.date_der_maj || '',
        lastRecordDate: new Date().toISOString(), // Assuming last record date is now
      };
    }

    // Address
    if (row.id_ban_adresse) {
      addresses[row.id_ban_adresse] = {
        ...addresses?.[row.id_ban_adresse] || {},
        id: row.id_ban_adresse,
        mainCommonToponymID: row.id_ban_toponyme,
        secondaryCommonToponymIDs: row.id_ban_toponymes_secondaires ? row.id_ban_toponymes_secondaires.split('|') : [],
        districtID: row.id_ban_commune,
        mainCommonToponym: commonToponyms[row.id_ban_toponyme] || {},
        districts: districts[row.id_ban_commune] || {},
        labels: getterLabels('lieudit_complement_nom') || [],
        number: row.numero,
        suffix: row.suffixe,
        certified: [1, '1', 'oui', 'true', true].includes(row.certification_commune),
        positions: getItemPositions(addresses[row.id_ban_adresse], row),
        meta: {
          ban: {
            source: row.source || '',
            sourcePosition: row.ban_source_source_position || '',
            hashIdFix: row.ban_enrich_hash_id_fix || '',
            DEPRECATED_cleInterop: row.cle_interop || '',
            DEPRECATED_cleInteropBAN: row.ban_enrich_deprecated_cle_interop || '',
            targetKey: row.ban_enrich_ban_target_key_address || [''],
            oldDistrict: row.ban_enrich_old_district_code && row.ban_enrich_old_district_name
              ? {
                "labels": [{
                  "isoCode": "fra",
                  "value": row.ban_enrich_old_district_name
                }],
                "code": row.ban_enrich_old_district_code
              }
              : addresses[row.id_ban_adresse]?.meta?.ban?.oldDistrict || null,
          },
          dgfip: {
            cadastre: (row.cadastre_parcelles || row.cad_parcelles || null)?.split('|') || [],
            DEPRECATED_codeFantoir: row.ban_enrich_code_fantoir || '',
          },
          insee: {
            cog: row.commune_insee || '',
            mainCog: row.ban_enrich_main_cog || '',
            isMainCog: row.ban_enrich_is_main_cog || '',
          },
          laPoste: {
            codePostal: row.ban_enrich_code_postal ? [row.ban_enrich_code_postal.split('|')] : [],
          },
        },
        legalityDate: row.date_der_maj || '',
        lastRecordDate: new Date().toISOString(), // Assuming last record date is now
      }
    }
  });

  return {
    districts,
    commonToponyms,
    addresses,
  };
}
