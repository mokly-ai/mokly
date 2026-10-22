import assert from "node:assert/strict";
import test from "node:test";

import {
  ENTRY_NOUNS,
  entryWording,
  type EntryKind,
} from "../packages/viewer/dist/shell/entry_wording.js";

/**
 * Every noun that could name a catalogue entry or one of its states, in the
 * singular. The plural "components" of the changed components never matches.
 */
const NOUNS =
  /\b(?:saved view|saved variant|use case|user flow|screen|variant|component|page|document|view|entry|item|flow|state)\b/giu;

/**
 * The sentences that name the catalogue item: the file list, and the matched
 * and unresolved sentences of the item's own rules. Every other sentence
 * names the shown entry.
 */
const ITEM_SENTENCES = new Set([
  "filesLead",
  "matchedStylesWithSelectors",
  "matchedStylesWithoutSelectors",
  "unresolvedStylesWithSelectors",
  "unresolvedStylesWithoutSelectors",
]);

/** Screen copy that the comparison panes recast for each kind. */
const SCREEN_LABELS = [
  "Screen changed",
  "No changes to this screen",
  "New screen",
  "Screen removed",
  "This screen has been removed.",
  "This screen did not exist before.",
  "This screen has no comparison available.",
];

test("each kind declares its nouns in one place", () => {
  // Component copy names the shown entry a variant, but its file list and
  // its own rules name the component, as the presentation contract fixes.
  assert.deepEqual(ENTRY_NOUNS, {
    screen: { entry: "screen", within: "on", item: "screen" },
    component: { entry: "variant", within: "in", item: "component" },
    page: { entry: "page", within: "on", item: "page" },
  });
});

test("every sentence of a kind names only that kind's noun", () => {
  for (const kind of Object.keys(ENTRY_NOUNS) as EntryKind[]) {
    const nouns = ENTRY_NOUNS[kind];
    const wording = entryWording(kind);
    const sentences = [
      ...Object.entries(wording).filter(
        (pair): pair is [string, string] => typeof pair[1] === "string",
      ),
      ...SCREEN_LABELS.map((copy) => ["label", wording.label(copy)] as const),
    ];
    for (const key of ITEM_SENTENCES) assert.ok(key in wording, key);
    for (const [key, sentence] of sentences) {
      const noun = ITEM_SENTENCES.has(key) ? nouns.item : nouns.entry;
      const named = [...sentence.matchAll(NOUNS)].map(([word]) =>
        word.toLowerCase(),
      );
      assert.ok(named.length > 0, `${kind} ${key} names nothing: ${sentence}`);
      assert.deepEqual(new Set(named), new Set([noun]), `${kind} ${key}`);
    }
  }
});
