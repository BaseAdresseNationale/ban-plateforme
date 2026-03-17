type Label = {
  isoCode: string;
  value: string;
};

const EMPTY_TOPONYM_BAL_IDENTIFIER = 99_999; // Valeur utilisée dans la BAL pour indiquer un toponyme sans numero.

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

export const getBanObjectsFromBalRows = (rows: any[], defaultIsoCode: string, isWithId: boolean = true) => {
  const addresses: Record<string, any> = {};
  const commonToponyms: Record<string, any> = {};
  const districts: Record<string, any> = {};

  const standardizeLabel = (label: string) => {
    var string_norm = label.normalize('NFD').replace(/\p{Diacritic}/gu, ''); // Old method: .replace(/[\u0300-\u036f]/g, "");
    console.log(string_norm);

    return string_norm.trim().toUpperCase().replace(/\s+/g, '_');
}
  rows.forEach((row: any) => {
    const getterLabels = getLabelsFromRow(row, defaultIsoCode);

    const rowIds: { idDistrict?: string; idCommonToponym?: string; idAddress?: string } = {};

    // Utilisation des IDs-BAN stables si disponibles, sinon 
    // fallback sur des IDs instables générés à partir des données de la BAL
    if(isWithId) {
      if (row.id_ban_commune) rowIds.idDistrict = row.id_ban_commune;
      if (row.id_ban_toponyme) rowIds.idCommonToponym = row.id_ban_toponyme;
      if (row.id_ban_adresse) rowIds.idAddress = row.id_ban_adresse;
    } else {
      // - District : Code INSEE
      if(row.commune_insee)
        rowIds.idDistrict = `no-id-district--${row.commune_insee}`; // FIXME: Réccuperer l'ID-BAN de la commune ou générer un ID à partir du code INSEE
      // - CommonToponyme : [ID District (Without Prefix)] + Label dans un format standardisé (Latin-1, Majustule, Underscore en remplacement des espaces)
      if(getterLabels('voie_nom')[0]?.value)
        rowIds.idCommonToponym =
          `no-id-toponym--${
          rowIds.idDistrict?.split('--')[1] }--${
          standardizeLabel(getterLabels('voie_nom')[0].value) }`;
      // - Adresse : [ID District (Without Prefix)] + [ID CommonToponym (Without Prefix)] + Numero+suffix
      if(row.numero && parseInt(row.numero) !== EMPTY_TOPONYM_BAL_IDENTIFIER)
        rowIds.idAddress =
          `no-id-address--${
          rowIds.idDistrict?.split('--')[1]}--${
          rowIds.idCommonToponym?.split('--')?.[2] || 'unknown'}--${
          row.numero}${row.suffixe ? `-${row.suffixe}` : ''}`;
    }

    // TODO: Gérer les fusions profondes (plusieurs lignes pour une même entité) cf. oldDistrict

    // District // TODO: Ne plus composer les district à partir des données de la BAL, mais directement à partir de celle de la BDD PostgreSQL
    if (rowIds.idDistrict) {
      districts[rowIds.idDistrict] = {
        ...districts?.[rowIds.idDistrict] || {},
        id: rowIds.idDistrict,
        labels: getterLabels('commune_nom') || [],
        meta: {
          ban: {
            source: row.source || '',
            hashIdFix: row.ban_enrich_hash_id_fix || '',
            DEPRECATED_cleInterop: row.cle_interop || '',
            DEPRECATED_cleInteropBAN: row.ban_enrich_deprecated_cle_interop || '',
            targetKey: row.ban_enrich_ban_target_key_district || ['']
          },
          dgfip: {
            codeDepartement: row.code_departement || '',
          },
          insee: {
            cog: row.commune_insee || '',
            mainCog: row.ban_enrich_main_cog || row.commune_insee,
            mainId: row.id_ban_commune || '',
            isMain: row.ban_enrich_is_main_cog || true,
          },
        },
        legalityDate: row.date_der_maj || '',
        lastRecordDate: new Date().toISOString(), // Assuming last record date is now
      };
    }

    // Toponym
    if (rowIds.idCommonToponym) {
      commonToponyms[rowIds.idCommonToponym] = {
        ...commonToponyms?.[rowIds.idCommonToponym] || {},
        id: rowIds.idCommonToponym,
        districtID: rowIds.idDistrict,
        district: districts[rowIds.idDistrict as string] || {},
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
            mainId: row.id_ban_commune || '',
            isMain: row.ban_enrich_is_main_cog || '',
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
    if (rowIds.idAddress) {
      addresses[rowIds.idAddress] = {
        ...addresses?.[rowIds.idAddress] || {},
        id: rowIds.idAddress,
        mainCommonToponymID: rowIds.idCommonToponym,
        secondaryCommonToponymIDs: row.id_ban_toponymes_secondaires ? row.id_ban_toponymes_secondaires.split('|') : [],
        districtID: rowIds.idDistrict,
        mainCommonToponym: commonToponyms[rowIds.idCommonToponym as string] || {},
        districts: districts[rowIds.idDistrict as string] || {},
        labels: getterLabels('lieudit_complement_nom') || [],
        number: row.numero,
        suffix: row.suffixe,
        certified: [1, '1', 'oui', 'true', true].includes(row.certification_commune),
        positions: getItemPositions(addresses[rowIds.idAddress as string], row),
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
              : addresses[rowIds.idAddress as string]?.meta?.ban?.oldDistrict || null,
          },
          dgfip: {
            cadastre: (row.cadastre_parcelles || row.cad_parcelles || null)?.split('|') || [],
            DEPRECATED_codeFantoir: row.ban_enrich_code_fantoir || '',
          },
          insee: {
            cog: row.commune_insee || '',
            mainCog: row.ban_enrich_main_cog || '',
            mainId: row.id_ban_commune || '',
            isMain: row.ban_enrich_is_main_cog || '',
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
