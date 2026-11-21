/**
 * The kinds of note group that a release lists. The release tool writes one
 * level-three heading for each kind, such as `Bug Fixes`; the page names,
 * counts and filters the groups by kind. A heading that names none of these
 * kinds keeps its notes under its own heading.
 */

/** The kinds of note group that the page knows, in the changelog's order. */
export const GROUP_KINDS = [
  "breaking",
  "features",
  "fixes",
  "performance",
  "refactoring",
  "docs",
  "deps",
] as const;

/** One kind of note group. */
export type GroupKind = (typeof GROUP_KINDS)[number];

/** The kind of a group, or `other` for a heading that the page does not know. */
export type GroupKindOrOther = GroupKind | "other";

/** The release tool's heading of each kind, as the page compares it. */
const HEADINGS: Readonly<Record<string, GroupKind>> = {
  "breaking changes": "breaking",
  features: "features",
  "bug fixes": "fixes",
  "performance improvements": "performance",
  "code refactoring": "refactoring",
  documentation: "docs",
  dependencies: "deps",
};

/**
 * The kind that a level-three heading names. The comparison ignores case and
 * the warning sign that leads `⚠ BREAKING CHANGES`.
 */
export function groupKind(heading: string): GroupKindOrOther {
  const key = heading.trim().replace(/^⚠\s*/u, "").toLowerCase();
  return HEADINGS[key] ?? "other";
}
