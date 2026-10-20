import fs from "node:fs";

import { observeRange } from "./postcss-evidence.js";

type Descriptor = {
  path: string;
  offset: number | undefined;
  pending: Set<Ticket>;
};
type Ticket = {
  descriptor: Descriptor;
  offset: number | undefined;
  sequential: boolean;
  valid: boolean;
  suppressed: boolean;
};
const descriptors = new Map<number, Descriptor>();
const syncReaders = new Set<unknown>([fs.openSync, fs.readSync]);
let suppressed = 0;

export function markSyncReader(reader: unknown): void {
  syncReaders.add(reader);
}
export function nativeSyncReaders(): boolean {
  return syncReaders.has(fs.openSync) && syncReaders.has(fs.readSync);
}
export function wholeRead<T>(read: () => T): T {
  suppressed++;
  try {
    return read();
  } finally {
    suppressed--;
  }
}

export function opened(fd: number, file: string): void {
  closed(fd);
  descriptors.set(fd, { path: file, offset: 0, pending: new Set() });
}

export function closed(fd: number): void {
  invalidate(fd);
  descriptors.delete(fd);
}

/** Unobserved offset changes cannot supply a guessed sequential position. */
export function invalidate(fd: number): void {
  const state = descriptors.get(fd);
  if (!state) return;
  state.offset = undefined;
  for (const ticket of state.pending) ticket.valid = false;
}

export function begin(fd: number, position: unknown): Ticket | undefined {
  const descriptor = descriptors.get(fd);
  if (!descriptor) return;
  const sequential =
    position === undefined || position === null || position === -1;
  const explicit = typeof position === "bigint" ? Number(position) : position;
  if (
    !sequential &&
    (typeof explicit !== "number" ||
      !Number.isSafeInteger(explicit) ||
      explicit < 0)
  )
    return;
  if (sequential && [...descriptor.pending].some((ticket) => ticket.sequential))
    invalidate(fd);
  const ticket: Ticket = {
    descriptor,
    offset: sequential ? descriptor.offset : Number(explicit),
    sequential,
    valid: true,
    suppressed: suppressed > 0,
  };
  descriptor.pending.add(ticket);
  return ticket;
}

/** Completion hashes delivered bytes before the callback or promise returns them. */
export function finish(
  ticket: Ticket | undefined,
  bytes?: Uint8Array,
  eof = false,
): void {
  if (!ticket) return;
  const state = ticket.descriptor;
  state.pending.delete(ticket);
  if (!bytes) {
    if (ticket.sequential) state.offset = undefined;
    return;
  }
  if (!ticket.valid || ticket.offset === undefined) return;
  if (!ticket.suppressed) observeRange(state.path, ticket.offset, bytes, eof);
  if (ticket.sequential) state.offset = ticket.offset + bytes.length;
}
