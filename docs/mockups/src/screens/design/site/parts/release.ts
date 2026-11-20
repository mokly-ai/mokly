/**
 * Release facts depicted on the changelog. Every version, date,
 * note and compare link is taken from the installed package's `CHANGELOG.md` at
 * the time of authoring; the mockup never states a release fact of its own.
 */

/** One group of notes inside a release, such as Features or Bug fixes. */
export interface ReleaseGroup {
  notes: readonly string[];
  title: string;
}

/** One published release of the Mokly CLI. */
export interface Release {
  compare: string;
  date: string;
  groups: readonly ReleaseGroup[];
  id: string;
  readableDate: string;
  version: string;
}
