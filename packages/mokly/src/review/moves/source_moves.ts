import path from "node:path";

import type { Manifest } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../../config/types.js";
import type { BaselineReader } from "../git.js";

import { baselineEntryIndex } from "./entries.js";
import { currentSourceBytes, historicalSourceBytes } from "./source_files.js";
import { moveIdentity, type EntryMove } from "./types.js";

/** Confined source aliases derive from accepted module moves, never a guessed file rename. */
export function movedSourcePaths(
  before: Manifest,
  after: Manifest,
  moves: readonly EntryMove[],
): ReadonlyMap<string, string> {
  const baseEntries = baselineEntryIndex(before.entries, moves);
  const bases = new Set(before.sourceFiles),
    heads = new Set(after.sourceFiles);
  const proposals = new Map<string, Set<string>>();
  for (const head of after.entries) {
    const base = baseEntries.get(moveIdentity(head));
    if (!base || base.sourcePath === head.sourcePath) continue;
    const oldDirectory = path.posix.dirname(base.sourcePath),
      newDirectory = path.posix.dirname(head.sourcePath);
    for (const source of bases) {
      if (
        heads.has(source) ||
        (oldDirectory !== "." && !source.startsWith(`${oldDirectory}/`))
      )
        continue;
      const destination =
        source === base.sourcePath
          ? head.sourcePath
          : path.posix.join(
              newDirectory,
              path.posix.relative(oldDirectory, source),
            );
      if (!heads.has(destination) || bases.has(destination)) continue;
      const values = proposals.get(source) ?? new Set<string>();
      values.add(destination);
      proposals.set(source, values);
    }
  }
  const counts = new Map<string, number>();
  for (const values of proposals.values())
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return new Map(
    [...proposals].flatMap(([before, values]) => {
      const after = [...values][0]!;
      return values.size === 1 && counts.get(after) === 1
        ? [[before, after]]
        : [];
    }),
  );
}

/** Equal relocated source bytes cannot create an independent dependency reason. */
export async function unchangedMovedSources(
  before: Manifest,
  after: Manifest,
  moves: readonly EntryMove[],
  config: ResolvedConfig,
  reader: BaselineReader | undefined,
  commit: string,
): Promise<ReadonlySet<string>> {
  const unchanged = new Set<string>();
  if (!reader) return unchanged;
  await Promise.all(
    [...movedSourcePaths(before, after, moves)].map(async ([base, head]) => {
      const [left, right] = await Promise.all([
        historicalSourceBytes(base, before.sourceFiles, reader, commit),
        currentSourceBytes(head, after.sourceFiles, config),
      ]);
      if (left && right && Buffer.from(left).equals(right)) {
        unchanged.add(base);
        unchanged.add(head);
      }
    }),
  );
  return unchanged;
}
