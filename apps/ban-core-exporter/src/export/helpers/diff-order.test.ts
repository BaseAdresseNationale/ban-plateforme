import { describe, expect, it } from 'vitest';

import { DiffOrderBuffer } from './diff-order.js';

describe('DiffOrderBuffer', () => {
  it('emits dependency creation/update order before reverse disable order', async () => {
    const buffer = new DiffOrderBuffer();
    const written: string[] = [];
    const write = (event: string, type: string) => buffer.write(`${JSON.stringify({ event, type })}\n`);

    write('disabled', 'district');
    write('updated', 'address');
    write('created', 'toponym');
    write('disabled', 'address');
    write('created', 'district');
    write('disabled', 'toponym');

    await buffer.flush({
      write: chunk => { written.push(chunk); return true; },
      once: () => {},
    });

    expect(written.map(line => {
      const value = JSON.parse(line);
      return `${value.event}:${value.type}`;
    })).toEqual([
      'created:district', 'created:toponym', 'updated:address',
      'disabled:address', 'disabled:toponym', 'disabled:district',
    ]);
  });

  it('keeps the same dependency order for Standard FR type names', async () => {
    const buffer = new DiffOrderBuffer();
    const written: string[] = [];
    const write = (evenement: string, type: string) => buffer.write(`${JSON.stringify({ evenement, type })}\n`);

    write('disabled', 'commune');
    write('updated', 'adresse');
    write('created', 'odonyme');
    write('disabled', 'adresse');
    write('created', 'commune');
    write('disabled', 'odonyme');

    await buffer.flush({
      write: chunk => { written.push(chunk); return true; },
      once: () => {},
    });

    expect(written.map(line => {
      const value = JSON.parse(line);
      return `${value.evenement}:${value.type}`;
    })).toEqual([
      'created:commune', 'created:odonyme', 'updated:adresse',
      'disabled:adresse', 'disabled:odonyme', 'disabled:commune',
    ]);
  });
});
