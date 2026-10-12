import Cursor from 'pg-cursor';

import type { BanFormatter } from '../types.js';

function readCursor(cursor: Cursor, size: number) {
  return new Promise<Record<string, unknown>[]>((resolve, reject) => {
    cursor.read(size, (error, rows) => (error ? reject(error) : resolve(rows as Record<string, unknown>[])));
  });
}

export function closeCursor(cursor: Cursor | null) {
  return new Promise(resolve => {
    if (!cursor) {
      resolve(false);
      return;
    }

    try {
      cursor.close(() => resolve(true));
    } catch {
      resolve(false);
    }
  });
}

type WritableTarget = {
  write: (chunk: string) => boolean;
  once: (event: 'drain', listener: () => void) => void;
};

function waitForDrain(stream: WritableTarget) {
  return new Promise<void>(resolve => {
    stream.once('drain', resolve);
  });
}

export async function streamCursorData({
  cursor,
  fetchSize,
  dataName,
  output,
  banFormatter,
}: {
  cursor: Cursor;
  fetchSize: number;
  dataName: string;
  output: WritableTarget;
  banFormatter: BanFormatter;
}) {
  const stats: Record<string, number> = {
    count: 0,
  };

  while (true) {
    const rows = await readCursor(cursor, fetchSize);
    if (!rows.length) {
      break;
    }

    for (const row of rows) {
      const line = row[dataName];

      if (line == null) {
        continue;
      }

      const objLineRaw = typeof line === 'string' ? JSON.parse(line) : {};
      const objLine = banFormatter(objLineRaw);

      if (!objLine) {
        continue;
      }

      if (!output.write(`${JSON.stringify(objLine)}\n`)) {
        await waitForDrain(output);
      }

      stats.count += 1;

      if (typeof objLine === 'object') {
        const event = 'event' in objLine ? objLine.event : 'evenement' in objLine ? objLine.evenement : undefined;
        if (typeof event === 'string') {
          stats[event] = (stats[event] || 0) + 1;
        }
      }
    }
  }

  return stats;
}
