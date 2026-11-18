import { writeChunk, type WritableTarget } from './write-chunk.js';
const dependencyTypes = [
  ['district'],
  ['toponym'],
  ['address'],
];

export class DiffOrderBuffer {
  private readonly lines = new Map<string, string[]>();

  write(chunk: string) {
    const line = JSON.parse(chunk) as { event?: string; type?: string };
    const event = line.event;
    if (!event || !line.type || !['created', 'updated', 'disabled'].includes(event)
      || !dependencyTypes.flat().includes(line.type)) throw new Error('Invalid DIFF output line');
    const key = `${event}:${line.type}`;
    this.lines.set(key, [...(this.lines.get(key) ?? []), chunk]);
    return true;
  }

  once(_event: 'drain', _listener: () => void) {}

  async flush(output: WritableTarget, signal?: AbortSignal) {
    for (const event of ['created', 'updated']) {
      await this.writeEventInDependencyOrder(output, event, dependencyTypes, signal);
    }
    await this.writeEventInDependencyOrder(output, 'disabled', [...dependencyTypes].reverse(), signal);
  }

  private async writeEventInDependencyOrder(output: WritableTarget, event: string, types: string[][], signal?: AbortSignal) {
    for (const names of types) {
      for (const type of names) await this.writeLines(output, this.lines.get(`${event}:${type}`) ?? [], signal);
    }
  }

  private async writeLines(output: WritableTarget, lines: string[], signal?: AbortSignal) {
    for (const line of lines) {
      await writeChunk(output, line, signal);
    }
  }
}
