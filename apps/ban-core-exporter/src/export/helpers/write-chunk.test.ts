import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { writeChunk } from './write-chunk.js';

describe('writeChunk backpressure', () => {
  it('waits until a slow destination drains', async () => {
    let flush!: () => void;
    const output = new Writable({ highWaterMark: 1, write(_chunk, _encoding, callback) { flush = callback; } });
    let done = false;
    const writing = writeChunk(output, 'line').then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    flush();
    await writing;
    expect(done).toBe(true);
    output.destroy();
  });

  it('rejects instead of waiting forever when a destination fails', async () => {
    const output = new Writable({ highWaterMark: 1, write() {} });
    const writing = writeChunk(output, 'line');
    const rejected = expect(writing).rejects.toThrow('disk failed');
    output.destroy(new Error('disk failed'));
    await rejected;
  });

  it('cancels a blocked write and removes the drain listener', async () => {
    const output = new Writable({ highWaterMark: 1, write() {} });
    const controller = new AbortController();
    const writing = writeChunk(output, 'line', controller.signal);
    const rejected = expect(writing).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(output.listenerCount('drain')).toBe(0);
    output.destroy();
  });
});
