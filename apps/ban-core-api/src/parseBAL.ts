import fs from 'node:fs/promises';
import Papa from 'papaparse';

export async function parseBALFile(filePath: string): Promise<any> {
  const content = await fs.readFile(filePath, 'utf-8');
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve({ id: Date.now().toString(), rows: results.data }),
      error: reject
    });
  });
}
