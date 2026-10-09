type WritableTarget = { write: (chunk: string) => boolean; once: (event: 'drain', listener: () => void) => void };
const dependencyTypes = [
  ['district', 'commune'],
  ['toponym', 'odonyme'],
  ['address', 'adresse'],
];

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
      await this.writeEventInDependencyOrder(output, event, dependencyTypes);
    }
    await this.writeEventInDependencyOrder(output, 'disabled', [...dependencyTypes].reverse());
  }

  private async writeEventInDependencyOrder(output: WritableTarget, event: string, types: string[][]) {
    for (const names of types) {
      for (const type of names) await this.writeLines(output, this.lines.get(`${event}:${type}`) ?? []);
    }
  }

  private async writeLines(output: WritableTarget, lines: string[]) {
    for (const line of lines) {
      if (!output.write(line)) await new Promise<void>(resolve => output.once('drain', resolve));
    }
  }
}
