import { type Manifest, type ManifestEntry } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../../config/types.js";
import { parseFrontMatter } from "../../documents/front_matter.js";
import type { BaselineReader } from "../git.js";

import { historicalSourceBytes, currentSourceBytes } from "./source_files.js";
import { moveIdentity } from "./types.js";

/** Private authoring evidence; these bytes never enter public comparison artifacts. */
export interface MarkdownMoveSources {
  before: ReadonlyMap<string, string>;
  after: ReadonlyMap<string, string>;
}

/** Read authored candidates through committed history and accepted current bodies. */
export async function readMoveMarkdown(
  before: Manifest,
  after: Manifest,
  config: ResolvedConfig,
  sourceReader: BaselineReader,
  commit: string,
  accepted?: ReadonlyMap<string, string>,
): Promise<MarkdownMoveSources> {
  const candidates = (own: Manifest, other: Manifest) => {
    const existing = new Set(other.entries.map(moveIdentity));
    return own.entries.filter(
      (entry) =>
        entry.kind === "document" && !existing.has(moveIdentity(entry)),
    );
  };
  const read = async (
    entries: readonly ManifestEntry[],
    side: "before" | "after",
  ) => {
    const result = new Map<string, string>();
    await Promise.all(
      entries.map(async (entry) => {
        if (side === "after" && accepted !== undefined) {
          if (accepted.has(entry.sourcePath))
            result.set(entry.sourcePath, accepted.get(entry.sourcePath)!);
          return;
        }
        const source =
          side === "before"
            ? await historicalSourceBytes(
                entry.sourcePath,
                before.sourceFiles,
                sourceReader,
                commit,
              )
            : await currentSourceBytes(
                entry.sourcePath,
                after.sourceFiles,
                config,
              );
        if (source !== undefined)
          result.set(
            entry.sourcePath,
            parseFrontMatter(
              Buffer.from(source).toString("utf8"),
              entry.sourcePath,
            ).body,
          );
      }),
    );
    return result;
  };
  const [base, head] = await Promise.all([
    read(candidates(before, after), "before"),
    read(candidates(after, before), "after"),
  ]);
  return { before: base, after: head };
}
