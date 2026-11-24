/**
 * The upgrade notes of a release: the Markdown under its `### Upgrade Notes`
 * heading, read in full. Each `####` heading opens a topic, and a `#####`
 * heading opens a subtopic inside it. A topic holds its subtopic headings,
 * its paragraphs, with their wrapped lines joined, and its lists, whose items
 * keep their nested items. Text before the first topic heading forms a topic
 * without a title, so no word is lost.
 */

import { type NoteItem, readItems } from "./items.js";
import { type LinkResolver, type NoteSegment, parseNote } from "./notes.js";

/** One block of a topic, in the order the notes give them. */
export type UpgradeBlock =
  | { readonly kind: "list"; readonly items: readonly NoteItem[] }
  | { readonly kind: "paragraph"; readonly text: readonly NoteSegment[] }
  | { readonly kind: "subtopic"; readonly title: readonly NoteSegment[] };

/** One topic of the upgrade notes: its title and its blocks. */
export interface UpgradeTopic {
  readonly blocks: readonly UpgradeBlock[];
  /** The text of the topic's heading; none for text before the first one. */
  readonly title: readonly NoteSegment[] | undefined;
}

/** A topic heading and a subtopic heading, with an optional closing `#` run. */
const TOPIC = /^####\s+(.+?)(?:\s+#+)?\s*$/;
const SUBTOPIC = /^#####+\s+(.+?)(?:\s+#+)?\s*$/;

/** A list item line, at any indentation. */
const ITEM = /^\s*[*-] /;

/** A topic while its lines are read. */
interface Draft {
  readonly blocks: UpgradeBlock[];
  readonly title: readonly NoteSegment[] | undefined;
}

/** Read the lines under `### Upgrade Notes`, up to the next heading of a higher level. */
export function readUpgrade(
  lines: readonly string[],
  resolve: LinkResolver,
): readonly UpgradeTopic[] {
  const topics: Draft[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let blank = false;
  const topic = (): Draft => {
    const last = topics.at(-1);
    if (last !== undefined) return last;
    const untitled: Draft = { blocks: [], title: undefined };
    topics.push(untitled);
    return untitled;
  };
  const close = (): void => {
    if (paragraph.length > 0)
      topic().blocks.push({
        kind: "paragraph",
        text: parseNote(paragraph.join(" "), resolve),
      });
    if (list.length > 0)
      topic().blocks.push({ items: readItems(list, resolve), kind: "list" });
    paragraph = [];
    list = [];
  };
  for (const line of lines) {
    const opened = SUBTOPIC.exec(line) ?? TOPIC.exec(line);
    if (opened !== null) {
      close();
      const title = parseNote(opened[1] ?? "", resolve);
      if (line.startsWith("#####"))
        topic().blocks.push({ kind: "subtopic", title });
      else topics.push({ blocks: [], title });
      blank = false;
      continue;
    }
    if (line.trim().length === 0) {
      if (paragraph.length > 0) close();
      blank = true;
      continue;
    }
    const continues = list.length > 0 && (!blank || /^\s/.test(line));
    if (ITEM.test(line) || continues) {
      if (paragraph.length > 0) close();
      list.push(line);
    } else {
      if (list.length > 0) close();
      paragraph.push(line.trim());
    }
    blank = false;
  }
  close();
  return topics.filter(
    (draft) => draft.title !== undefined || draft.blocks.length > 0,
  );
}
