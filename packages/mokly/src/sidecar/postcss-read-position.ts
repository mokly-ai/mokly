import fs from "node:fs";

import type { PostcssFileIdentity } from "../generated/sidecar/PostcssFileIdentity.js";

import { observeRange } from "./postcss-evidence.js";
import { fileIdentity } from "./postcss-file-identity.js";

type Descriptor = {
  path: string;
  offset: number | undefined;
  pending: Set<Ticket>;
  inspect: () => PostcssFileIdentity | undefined;
};
type Ticket = {
  descriptor: Descriptor;
  offset: number | undefined;
  sequential: boolean;
  valid: boolean;
  suppressed: boolean;
  identity: PostcssFileIdentity | undefined;
};
const descriptors = new Map<number, Descriptor>();
const syncReaders = new Set<unknown>([fs.openSync, fs.readSync]);
let suppressed = 0;
let opaqueCursors = false;
const wholeIdentities: Array<(identity: PostcssFileIdentity) => void> = [];

export function markSyncReader(reader: unknown): void {
  syncReaders.add(reader);
}
export function nativeSyncReaders(): boolean {
  return syncReaders.has(fs.openSync) && syncReaders.has(fs.readSync);
}
export function wholeRead<T>(
  read: () => T,
  identity: (value: PostcssFileIdentity) => void,
): T {
  suppressed++;
  wholeIdentities.push(identity);
  try {
    return read();
  } finally {
    suppressed--;
    wholeIdentities.pop();
  }
}

export function opened(
  fd: number,
  file: string,
  inspect: () => PostcssFileIdentity | undefined = () => fileIdentity(fd, file),
): void {
  closed(fd);
  descriptors.set(fd, {
    path: file,
    offset: opaqueCursors ? undefined : 0,
    pending: new Set(),
    inspect,
  });
  const identity = inspect();
  if (identity) wholeIdentities.at(-1)?.(identity);
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

/** Native descriptor access can move offsets without a JavaScript completion event. */
export function opaqueDescriptorAccess(): void {
  opaqueCursors = true;
  for (const fd of descriptors.keys()) invalidate(fd);
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
    identity: descriptor.inspect(),
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
  if (!ticket.suppressed)
    observeRange(state.path, ticket.offset, bytes, eof, ticket.identity);
  if (ticket.sequential) state.offset = ticket.offset + bytes.length;
}
