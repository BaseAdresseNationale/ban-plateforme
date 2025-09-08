import Papa from 'papaparse';

export async function parseBalForBan(fileStreamOrCsvContent: NodeJS.ReadableStream | string) {
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

export default parseBalForBan;