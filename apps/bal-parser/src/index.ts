import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import rascal from 'rascal';

const inputFile = process.argv[2] || 'input/bal-96001-cocorico.1.4.fra.geo.csv'; // TODO : remove the default input test file
const csvFilePath = path.resolve(inputFile);

const config = {
  vhosts: {
    '/': {
      connection: {
        protocol: 'amqp',
        hostname: 'localhost',
        user: 'guest',
        password: 'guest',
        port: 5672,
      },
      exchanges: [
        { name: 'bal.events', type: 'topic' as const }
      ]
    }
  },
  publications: {
    balParsed: {
      exchange: 'bal.events',
      routingKey: 'bal.parsed'
    }
  }
};

async function parseAndPublish() {
  try {
    const broker = await rascal.BrokerAsPromised.create(config);
    const fileStream = fs.createReadStream(csvFilePath, { encoding: 'utf8' });
    const parsedRows: any[] = [];

    let rowCount = 0; // Initialize row count
    await new Promise<void>((resolve, reject) => {
      Papa.parse(fileStream, {
        worker: true,
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        beforeFirstChunk: (chunk) => {
          // Remove BOM (Byte Order Mark) if present
          return chunk.replace(/^\uFEFF/, '');
        },
        step: (results, parser) => {
          const row = results.data as Record<string, any>;
          // console.log(`Row Index: ${rowIndex}`, row.data); // Log the index and row data
          // console.log("Row errors:", row.errors); // TODO: Throw an error if there are parsing errors
          parsedRows.push({
            __balRowIndex: rowCount, // Add row index to each row
            ...row,
          });
          rowCount++; // Increment row count for each row
        },
        complete: (result) => {
          console.log(rowCount, 'lignes parsées');
          resolve();
        },
        error: reject
      });
    });

    const message = {
      id: uuidv4(),
      meta: {
        parsedAt: new Date().toISOString(),
        filename: path.basename(csvFilePath)
      },
      rows: parsedRows
    };

    const payload = JSON.stringify(message);
    await broker.publish('balParsed', payload, {
      options: { contentType: 'application/json' }
    });

    console.log('[bal-parser] Message envoyé sur "bal.parsed" : Contenu de la BAL parsée', new Date().toLocaleDateString(), new Date().toLocaleTimeString());
    console.log('[bal-parser] Message bal.parsed publié avec', parsedRows.length, 'lignes');

    await broker.shutdown();
  } catch (err) {
    console.error('[bal-parser] Erreur :', err);
    process.exit(1);
  }
}

parseAndPublish();
