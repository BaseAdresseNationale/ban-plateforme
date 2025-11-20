import Papa from 'papaparse';

export async function csvBalToJsonBal(fileStreamOrCsvContent: NodeJS.ReadableStream | string) {
  const parsedRows: any[] = [];
  let rowCount = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      Papa.parse(fileStreamOrCsvContent, {
        worker: true,
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        beforeFirstChunk: (chunk) => {
          if (typeof chunk !== 'string') {
            return chunk;
          }
          // Remove BOM (Byte Order Mark) if present
          // This is useful if the CSV file starts with a BOM character
          // which can happen with some CSV exports
          // https://stackoverflow.com/questions/1293147/remove-bom-from-string-in-javascript
          return chunk.replace(/^\uFEFF/, '');
        },
        step: (results, parser) => {
          const row = results.data as Record<string, any>;
          parsedRows.push({
            __balRowIndex: rowCount, // Add row index to each row
            ...row,
          });
          rowCount++; // Increment row count for each row
        },
        transform: (value: string, headerName: string) => {
          const trimmedValue = value.trim();
          const trimmedHeaderName = headerName.trim();
          switch (trimmedHeaderName) {
            case 'cle_interop':
            case 'commune_nom':
            case 'commune_insee':
            case 'commune_deleguee_nom':
            case 'voie_nom':
            case 'lieudit_complement_nom':
            case 'suffixe':
            case 'position':
            case 'source':
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
        complete: (result) => {
          console.log(rowCount, 'lignes parsées'); // TODO: Only for debug
          if (rowCount === 0) {
            console.error('Aucune ligne parsée. Vérifiez le fichier CSV.');
            reject(new Error('Aucune ligne parsée'));
            return;
          }
          resolve();
        },
        error: reject
      });
    });

  } catch (error) {
    console.error('Erreur lors du parsing du fichier CSV:', error);
    throw error;
  }

  return parsedRows;
}

export default csvBalToJsonBal;