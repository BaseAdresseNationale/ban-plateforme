import type { DataType } from '../types.js';

type WritableTarget = { write: (chunk: string) => boolean; once: (event: 'drain', listener: () => void) => void };
const forward: DataType[] = ['district', 'toponym', 'address'];
const reverse: DataType[] = [...forward].reverse();

export class DiffOrderBuffer {
  private readonly lines = new Map<string, string[]>();

  write(chunk: string) {
    const line = JSON.parse(chunk) as { event?: string; evenement?: string; type?: string };
    const event = line.event ?? line.evenement;
    if (!event || !line.type) throw new Error('Invalid DIFF output line');
    const key = `${event}:${line.type}`;
    this.lines.set(key, [...(this.lines.get(key) ?? []), chunk]);
    return true;
  }

  once(_event: 'drain', _listener: () => void) {}

  async flush(output: WritableTarget) {
    for (const event of ['created', 'updated']) {
      for (const type of forward) await this.writeLines(output, this.lines.get(`${event}:${type}`) ?? []);
    }
    for (const type of reverse) await this.writeLines(output, this.lines.get(`disabled:${type}`) ?? []);
  }

  private async writeLines(output: WritableTarget, lines: string[]) {
    for (const line of lines) {
      if (!output.write(line)) await new Promise<void>(resolve => output.once('drain', resolve));
    }
  }
}
