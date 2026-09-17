import path from "node:path";

import { Header, Parser, type ReadEntry } from "tar";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { MAX_ARCHIVE_BYTES } from "./process.js";

export const MAX_ARCHIVE_ENTRIES = 65_536;
export interface ArchiveEntry {
  readonly path: string;
  readonly kind: "file" | "directory" | "symlink";
  readonly mode: number;
  readonly bytes: Uint8Array;
  readonly target?: string;
}

/** Decode Git's uncompressed tar, then validate the entire tree before any writes. */
export async function parseBaselineArchive(
  bytes: Uint8Array,
): Promise<readonly ArchiveEntry[]> {
  if (
    bytes.length > MAX_ARCHIVE_BYTES ||
    bytes.length < 1024 ||
    bytes.length % 512 !== 0 ||
    bytes.subarray(-1024).some((byte) => byte !== 0)
  )
    throw new Error("Invalid or oversized Git archive");
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = new Header(buffer.subarray(0, 512));
  if (!header.cksumValid && !header.nullBlock)
    throw new Error("Invalid uncompressed Git archive header");
  const entries = await new Promise<ArchiveEntry[]>((resolve, reject) => {
    const parser = new Parser({ strict: true });
    const entries: ArchiveEntry[] = [];
    parser.on("error", reject);
    parser.on("ignoredEntry", () =>
      reject(new Error("Unsupported Git archive entry")),
    );
    parser.on("entry", (entry: ReadEntry) => {
      const kind =
        entry.type === "File" || entry.type === "OldFile"
          ? "file"
          : entry.type === "Directory"
            ? "directory"
            : entry.type === "SymbolicLink"
              ? "symlink"
              : undefined;
      if (entries.length >= MAX_ARCHIVE_ENTRIES) {
        parser.abort(
          new Error(`Git archive exceeds ${MAX_ARCHIVE_ENTRIES} entries`),
        );
        return;
      }
      if (!kind) {
        parser.abort(new Error(`Unsupported Git archive entry: ${entry.path}`));
        return;
      }
      const chunks: Buffer[] = [];
      entry.on("data", (chunk: Buffer) => chunks.push(chunk));
      entry.on("error", reject);
      entry.on("end", () =>
        entries.push({
          path:
            kind === "directory" ? entry.path.replace(/\/$/, "") : entry.path,
          kind,
          mode: (entry.mode ?? 0o644) & 0o777,
          bytes: chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks),
          ...(kind === "symlink" ? { target: entry.linkpath ?? "" } : {}),
        }),
      );
    });
    parser.on("end", () => resolve(entries));
    parser.end(buffer);
  });
  validateTree(entries);
  return entries;
}

function validateTree(entries: readonly ArchiveEntry[]): void {
  const tree = new Map<string, ArchiveEntry>();
  for (const entry of entries) {
    if (!isSafeRepositoryPath(entry.path) || tree.has(entry.path))
      throw new Error(`Unsafe or duplicate archive path: ${entry.path}`);
    tree.set(entry.path, entry);
  }
  for (const entry of entries) {
    let parent = path.posix.dirname(entry.path);
    while (parent !== ".") {
      const ancestor = tree.get(parent);
      if (ancestor && ancestor.kind !== "directory")
        throw new Error(
          `Archive path has a non-directory ancestor: ${entry.path}`,
        );
      parent = path.posix.dirname(parent);
    }
    if (entry.kind === "symlink") resolveLink(entry.path, tree);
  }
}

function resolveLink(
  name: string,
  tree: ReadonlyMap<string, ArchiveEntry>,
): void {
  const stack = path.posix
    .dirname(name)
    .split("/")
    .filter((part) => part !== ".");
  const pending = (tree.get(name)?.target ?? "").split("/");
  const seen = new Set([name]);
  checkTarget(tree.get(name)?.target ?? "", name);
  while (pending.length) {
    const part = pending.shift()!;
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!stack.length) throw new Error(`Outward archive symlink: ${name}`);
      stack.pop();
      continue;
    }
    const candidate = [...stack, part].join("/");
    const entry = tree.get(candidate);
    if (entry?.kind === "symlink") {
      if (seen.has(candidate))
        throw new Error(`Cyclic archive symlink: ${name}`);
      seen.add(candidate);
      checkTarget(entry.target ?? "", name);
      pending.unshift(...entry.target!.split("/"));
    } else {
      if (entry?.kind === "file" && pending.length)
        throw new Error(`Non-directory symlink target: ${name}`);
      stack.push(part);
    }
  }
}

function checkTarget(target: string, name: string): void {
  if (!target || target.startsWith("/") || /[\\:\0]/.test(target))
    throw new Error(`Unsafe archive symlink: ${name}`);
}
