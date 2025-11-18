import type { Bal } from '@ban/types';

import Papa from 'papaparse';

const jsonBalToCsvBal = (jsonBal: Bal): string => {
  // TODO: Gerer les colonnes optionnelles
  const columns = [
    'uid_adresse',
    'cle_interop',
    'commune_insee',
    'commune_nom',
    'commune_deleguee_insee',
    'commune_deleguee_nom',
    'voie_nom',
    'lieudit_complement_nom',
    'numero',
    'suffixe',
    'position',
    'x',
    'y',
    'long',
    'lat',
    'cad_parcelles',
    'source',
    'date_der_maj',
  ];
  const optionalColumns = [
    ...new Set(jsonBal.flatMap((cur) => Object.keys(cur))),
  ].filter((cur) => !columns.includes(cur));
  const options = {
    delimiter: ';',
    header: true,
    columns: [...columns, ...optionalColumns],
  };

  return Papa.unparse(jsonBal, options);
};

export default jsonBalToCsvBal;
