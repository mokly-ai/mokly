/**
 * The status line of the note filter: how many notes of the chosen group and
 * how many releases the page shows, such as `290 notes in 24 releases` or
 * `1 bug fix in 1 release`. The filter part renders it for All, and the
 * changelog island writes it for each choice.
 */

import type { GroupKind } from "../../changelog/groups.js";

/** The note groups that the filter offers after All, in its order. */
export const FILTER_GROUPS = [
  "breaking",
  "features",
  "fixes",
  "performance",
] as const satisfies readonly GroupKind[];

/** The choices of the filter: all notes, or one group of notes. */
export type FilterChoice = "all" | (typeof FILTER_GROUPS)[number];

/** The singular and plural noun of the notes of each choice. */
const NOUNS: Readonly<Record<FilterChoice, readonly [string, string]>> = {
  all: ["note", "notes"],
  breaking: ["breaking change", "breaking changes"],
  features: ["feature", "features"],
  fixes: ["bug fix", "bug fixes"],
  performance: ["performance improvement", "performance improvements"],
};

/** A count with the singular or the plural noun. */
function count(value: number, [one, many]: readonly [string, string]): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** Whether a value names a choice of the filter. */
export function isFilterChoice(value: string): value is FilterChoice {
  return Object.hasOwn(NOUNS, value);
}

/** The status line for a choice and the notes and releases it shows. */
export function filterStatus(
  choice: FilterChoice,
  notes: number,
  releases: number,
): string {
  return `${count(notes, NOUNS[choice])} in ${count(releases, ["release", "releases"])}`;
}
