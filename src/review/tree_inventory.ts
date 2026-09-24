import type { ManifestV6 } from "@mokly/viewer/data";

import {
  joinCataloguePath,
  type BaselineCatalogue,
} from "../baseline/catalogue.js";
import { MoklyError } from "../errors.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

import type { GitCommandRunner } from "./git.js";

interface TreeEntry {
  readonly mode: string;
  readonly hash: string;
}

/** One whole-tree request supplies manifest discovery and inventory verification. */
export async function readCommitTree(
  runner: GitCommandRunner,
  commit: string,
): Promise<ReadonlyMap<string, TreeEntry>> {
  const output = await runner.run([
    "ls-tree",
    "-r",
    "-t",
    "-z",
    "--full-tree",
    commit,
  ]);
  const entries = new Map<string, TreeEntry>();
  for (const item of output.split("\0")) {
    if (!item) continue;
    const match =
      /^(\d{6}) (blob|tree|commit) ([a-f0-9]{40}|[a-f0-9]{64})\t(.+)$/s.exec(
        item,
      );
    if (!match)
      throw new MoklyError("git-failed", `Invalid Git tree entry at ${commit}`);
    entries.set(match[4]!, { mode: match[1]!, hash: match[3]! });
  }
  return entries;
}

export function treeEntryKind(
  entry: TreeEntry | undefined,
): "regular" | "other" | "missing" {
  if (!entry) return "missing";
  return /^100[0-7]{3}$/.test(entry.mode) ? "regular" : "other";
}

/** Return the first inventory reason, keeping paths relative to the generated root. */
export function incompleteGeneratedInventory(
  tree: ReadonlyMap<string, TreeEntry>,
  descriptor: BaselineCatalogue,
  manifest: ManifestV6,
):
  | {
      reason: "missing" | "mismatched blob hashes" | "extra files";
      paths: string[];
    }
  | undefined {
  const actual = new Map<string, TreeEntry>();
  for (const [filename, entry] of tree) {
    if (filename.startsWith(`${descriptor.generatedRoot}/`))
      actual.set(filename.slice(descriptor.generatedRoot.length + 1), entry);
  }
  const expected = new Map(
    manifest.generatedFiles.map(({ path, blobHash }) => [path, blobHash]),
  );
  const missing = [...expected.keys()]
    .filter((route) => treeEntryKind(actual.get(route)) !== "regular")
    .sort();
  if (missing.length) return { reason: "missing", paths: missing };
  const mismatched = [...expected]
    .filter(([route, hash]) => actual.get(route)?.hash !== hash)
    .map(([route]) => route)
    .sort();
  if (mismatched.length)
    return { reason: "mismatched blob hashes", paths: mismatched };
  const extra = [...actual.keys()]
    .filter(
      (route) =>
        route !== MANIFEST_NAME &&
        !expected.has(route) &&
        actual.get(route)?.mode !== "040000",
    )
    .sort();
  if (extra.length) return { reason: "extra files", paths: extra };
}

export function inventoryDiagnostic(
  commit: string,
  issue: NonNullable<ReturnType<typeof incompleteGeneratedInventory>>,
): string {
  return `Mokly baseline ${commit}: rebuilding because generated output ${
    issue.reason === "missing"
      ? "is missing"
      : issue.reason === "extra files"
        ? "has extra files"
        : "has mismatched blob hashes"
  }: ${issue.paths.join(", ")}.`;
}

export function manifestTreePath(descriptor: BaselineCatalogue): string {
  return joinCataloguePath(descriptor.generatedRoot, MANIFEST_NAME);
}
