/**
 * Release facts depicted on the changelog. Every version, date, note, upgrade
 * note and compare link is copied verbatim from the installed package's
 * `CHANGELOG.md` at the time of authoring; the mockup never states a release
 * fact of its own.
 */

/** The kinds of note group that a release lists, in the changelog's order. */
export type ReleaseGroupKind =
  | "breaking"
  | "features"
  | "fixes"
  | "performance"
  | "refactoring"
  | "docs"
  | "deps";

/**
 * One group of notes inside a release, such as Features or Bug fixes. Each
 * note is the Markdown of one top-level item of the group's list without
 * its `* ` marker, as the release tool wrote it: an optional bold scope, the
 * text with its code spans, and the issue and commit links in parentheses.
 * Nested items follow on their own lines with their indentation.
 */
export interface ReleaseGroup {
  kind: ReleaseGroupKind;
  notes: readonly string[];
}

/** One published release of the Mokly CLI, from its level-two heading. */
export interface Release {
  /** The GitHub compare link of the heading. */
  compare: string;
  /** The release date of the heading, as `YYYY-MM-DD`. */
  date: string;
  groups: readonly ReleaseGroup[];
  /**
   * The upgrade notes, when the release's section publishes them: the
   * Markdown of each `####` or `#####` heading, paragraph and `- ` list item,
   * in order, with its wrapped lines joined by single spaces.
   */
  upgrade?: readonly string[] | undefined;
  version: string;
}
