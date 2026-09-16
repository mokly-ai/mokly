/**
 * Parse `CHANGELOG.md` into typed releases. The file is written by the
 * release tool, so its shape is fixed: a level-two heading names the version,
 * its release or compare link and the release date, level-three headings
 * group the notes, and every note is one list item. The parser never guesses
 * a date or invents a title. A level-two heading that names a version but not
 * a date fails the build, so a malformed release can never be published with
 * the wrong facts; a heading that names no version at all is prose the file
 * keeps beside its releases and is skipped with everything under it.
 */

import { type NoteSegment, parseNote } from "./notes.js";

/** One group of notes inside a release, such as Features or Bug fixes. */
export interface ReleaseSection {
  readonly heading: string;
  readonly items: ReadonlyArray<readonly NoteSegment[]>;
}

/** One published release of the Mokly CLI. */
export interface Release {
  readonly date: string;
  readonly link: string | null;
  readonly sections: readonly ReleaseSection[];
  readonly version: string;
}

/** A `CHANGELOG.md` the site cannot publish without guessing. */
export class ChangelogError extends Error {
  constructor(line: string) {
    super(
      `The changelog heading ${JSON.stringify(line)} does not name a version, a link and a release date.`,
    );
    this.name = "ChangelogError";
  }
}

const LINKED = /^## \[([^\]]+)\]\(([^)\s]+)\) \((\d{4}-\d{2}-\d{2})\)\s*$/;
const PLAIN = /^## ([^[\s]+) \((\d{4}-\d{2}-\d{2})\)\s*$/;
const VERSIONED = /^## \[?v?\d+\.\d+/;

/** The reader-facing name of a release-tool section heading. */
const HEADINGS: Readonly<Record<string, string>> = {
  "⚠ BREAKING CHANGES": "Breaking changes",
  "Bug Fixes": "Bug fixes",
  Features: "Features",
  "Performance Improvements": "Performance",
  Reverts: "Reverts",
};

function heading(raw: string): string {
  const value = raw.trim();
  return HEADINGS[value] ?? value.replace(/^⚠\s*/, "");
}

interface Draft {
  date: string;
  link: string | null;
  sections: Array<{ heading: string; items: string[] }>;
  version: string;
}

function release(draft: Draft): Release {
  return {
    date: draft.date,
    link: draft.link,
    sections: draft.sections
      .filter((section) => section.items.length > 0)
      .map((section) => ({
        heading: section.heading,
        items: section.items.map((item) => parseNote(item)),
      })),
    version: draft.version,
  };
}

/** Every release in the file, newest first, in the order the file lists. */
export function parseChangelog(source: string): readonly Release[] {
  const releases: Release[] = [];
  let draft: Draft | undefined;
  let item: string[] | undefined;
  const close = (): void => {
    if (item && draft) {
      draft.sections.at(-1)?.items.push(item.join(" ").trim());
      item = undefined;
    }
  };
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      close();
      if (draft) releases.push(release(draft));
      const match = LINKED.exec(line) ?? PLAIN.exec(line);
      if (!match) {
        if (VERSIONED.test(line)) throw new ChangelogError(line);
        draft = undefined;
        continue;
      }
      const [, first, second, third] = match;
      draft = {
        date: third ?? second ?? "",
        link: third === undefined ? null : (second ?? null),
        sections: [],
        version: first ?? "",
      };
      continue;
    }
    if (!draft) continue;
    if (line.startsWith("### ")) {
      close();
      draft.sections.push({ heading: heading(line.slice(4)), items: [] });
      continue;
    }
    if (/^[*-] /.test(line)) {
      close();
      if (draft.sections.length === 0)
        draft.sections.push({ heading: "Changes", items: [] });
      item = [line.slice(2).trim()];
      continue;
    }
    if (item && line.trim().length > 0) item.push(line.trim());
    else close();
  }
  close();
  if (draft) releases.push(release(draft));
  return releases;
}
