import { once } from 'node:events';
import type { Writable } from 'node:stream';

export type WritableTarget = Pick<Writable, 'write'>;

/** Wait for the destination, including failure/cancellation while backpressured. */
export const writeChunk = async (output: WritableTarget, chunk: string, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  if (!output.write(chunk)) await once(output as Writable, 'drain', { signal });
  signal?.throwIfAborted();
};
