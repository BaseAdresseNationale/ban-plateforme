import type { Bal } from '@ban/types';

import Papa from 'papaparse';

const csvBalToJsonBal = (csv: string): Bal => {
  return Papa.parse(csv, {
    delimiter: ';',
    header: true,
    skipEmptyLines: true,
    transform: (value: string, headerName: string) => {
      const trimmedValue = value.trim();
      const trimmedHeaderName = headerName.trim();
      switch (trimmedHeaderName) {
        case 'commune_insee':
        case 'commune_deleguee_insee':
          return trimmedValue && trimmedValue.padStart(5, '0');
        case 'numero':
          return parseInt(trimmedValue);
        case 'x':
        case 'y':
        case 'long':
        case 'lat':
          return parseFloat(trimmedValue);
        case 'certification_commune':
          return trimmedValue === '1';
        case 'cad_parcelles':
          return trimmedValue !== ''
            ? value.split('|').map((value) => value.trim())
            : [];
        case 'date_der_maj':
          return new Date(trimmedValue);
        case 'id_ban_commune':
        case 'id_ban_toponyme':
        case 'id_ban_adresse':
          return trimmedValue.toLowerCase();
        default:
          return trimmedValue;
      }
    },
  }).data as Bal;
};

export default csvBalToJsonBal;
