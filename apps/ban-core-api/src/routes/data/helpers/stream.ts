import Cursor from "pg-cursor";

function readCursor(cursor: Cursor, size: number) {
  return new Promise((resolve, reject) => {
    cursor.read(size, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

export function closeCursor(cursor: Cursor) {
  return new Promise((resolve) => {
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
  return new Promise<void>((resolve) => {
    stream.once('drain', resolve);
  });
}

export async function streamCursorData({
  cursor,
  fetchSize,
  dataName,
  format,
  output,
  banFormatter = (objLine: DataLine, converters?: FormatConfigs) => objLine,
  converters = {},
  isAborted,
}: {
  cursor: Cursor;
  fetchSize: number;
  dataName: string;
  format: string;
  output: WritableTarget;
  banFormatter: BanFormatter;
  converters?: Formatters;
  isAborted: () => boolean;
}) {
  const stats: Record<string, number> = {
    count: 0,
  };

  while (!isAborted()) {
    const rows = await readCursor(cursor, fetchSize) as Record<string, unknown>[];
    if (!rows.length) break;

    for (const row of rows) {
      const line = row[dataName];

      if (line == null) continue;
      const objLineRaw = typeof line === "string" ? JSON.parse(line) : {};

      let objLine = null;

      if( format === 'ban')
        objLine = banFormatter(objLineRaw);
      else if(format in converters)
        objLine = banFormatter(objLineRaw, converters[format]);
      else
        objLine = objLineRaw;

      if (!objLine) continue;

      if (!output.write(`${JSON.stringify(objLine)}\n`)) {
        await waitForDrain(output);
        if (isAborted()) break;
      }

      stats.count += 1;

      if (objLine.event) {
        stats[objLine.event] = (stats[objLine.event] || 0) + 1;
      }
    }
  }

  return stats;
}
