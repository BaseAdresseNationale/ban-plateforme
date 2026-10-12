import { DiffOrderBuffer } from '../helpers/diff-order.js';
import {
  getDiffObjLine, getBanStandardStartLine, getBanStandardEndLine, getSnapshotObjLine,
} from '../helpers/ndjson-data-line.js';
import { streamCursorData } from '../helpers/stream.js';
import { getAdministrativeScenario, scenarioTimes } from './administrative-scenario.js';
import type { DataLine, RawEntity } from '../types.js';

// Exercise the production serializer, ordering buffer and counters without SQL or services.
export const buildAdministrativeStreams = async () => {
  const scenario = getAdministrativeScenario();
  const streams: Record<string, RawEntity[]> = {};
  const plans = [
    { name: 'step-0_full-start', type: 'full', rows: scenario.start, at: scenarioTimes.start },
    { name: 'step-1_diff-first', type: 'diff', rows: scenario.firstDiff, from: scenarioTimes.start, to: scenarioTimes.middle },
    { name: 'step-2_full-middle', type: 'full', rows: scenario.middle, at: scenarioTimes.middle },
    { name: 'step-3_diff-second', type: 'diff', rows: scenario.secondDiff, from: scenarioTimes.middle, to: scenarioTimes.end },
    { name: 'step-4_full-end', type: 'full', rows: scenario.end, at: scenarioTimes.end },
  ];
  for (const plan of plans) {
    const params = { departements: ['96'], at: plan.at, from: plan.from, to: plan.to };
    const types = ['district', 'toponym', 'address'];
    const chunks: string[] = [];
    const output = { write: (line: string) => { chunks.push(line); return true; }, once: () => { } };
    output.write(getBanStandardStartLine(plan.type, params, types));
    const buffer = plan.type === 'diff' ? new DiffOrderBuffer() : null;
    const counters: Record<string, Record<string, number>> = {};
    for (const type of types) {
      const rows = plan.rows.filter((line: DataLine) => line.type === type)
        .map(line => ({ candidate: JSON.stringify(line) }));
      const cursor = { read: (_size: number, callback: (error: Error | null, batch: typeof rows) => void) => {
        callback(null, rows.splice(0));
      } };
      const stats = await streamCursorData({
        cursor: cursor as Parameters<typeof streamCursorData>[0]['cursor'], fetchSize: 500,
        dataName: 'candidate', output: buffer ?? output,
        banFormatter: plan.type === 'diff' ? getDiffObjLine : getSnapshotObjLine,
      });
      counters[type] = plan.type === 'diff'
        ? { count: stats.count, created: stats.created ?? 0, updated: stats.updated ?? 0, disabled: stats.disabled ?? 0 }
        : stats;
    }
    if (buffer) await buffer.flush(output);
    const ending = JSON.parse(getBanStandardEndLine(counters));
    ending.meta.generatedAt = scenarioTimes.generated;
    output.write(`${JSON.stringify(ending)}\n`);
    streams[plan.name] = chunks.map(line => JSON.parse(line));
  }
  return streams;
};
