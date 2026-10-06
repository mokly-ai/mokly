import assert from "node:assert/strict";
import test from "node:test";

import { pairMoves } from "../src/review/moves/pair.js";
import { documentSimilarity } from "../src/review/moves/similarity.js";

import { moveEntry, moveSignals } from "./helpers/move_entries.js";

test("similarity uses the line multiset with normalized endings and trailing whitespace", () => {
  assert.equal(documentSimilarity("a\na\nb", "a\nb\nb"), 2 / 3);
  assert.equal(documentSimilarity("a  \r\nb\t\r\n", "a\nb\n"), 1);
  assert.equal(documentSimilarity("a\nb", "a\nc"), 0.5);
  assert.equal(documentSimilarity("a\nb", "a\nc\nd"), 0.4);
  assert.equal(documentSimilarity("a\nb\nc", "a\nb\nd"), 2 / 3);
  assert.equal(documentSimilarity("", ""), 1);
  assert.equal(documentSimilarity("", "a"), 0);
});

test("similarity has an inclusive half threshold and excludes screens/components/flows", () => {
  for (const kind of [
    "document",
    "page",
    "screen",
    "component",
    "use-case",
  ] as const)
    for (const score of [0.49, 0.5, 0.51])
      assert.equal(
        pairMoves(
          [moveEntry("old", { kind })],
          [moveEntry("new", { kind })],
          moveSignals({ similarity: () => score }),
        ).moves.length,
        ["document", "page"].includes(kind) && score >= 0.5 ? 1 : 0,
      );
});

test("similarity requires unique mutual best matches rather than greedy choices", () => {
  const scores: Record<string, Record<string, number>> = {
    "old-a": { "new-a": 0.8, "new-b": 0.9 },
    "old-b": { "new-a": 0.7, "new-b": 0.6 },
  };
  assert.deepEqual(
    pairMoves(
      [
        moveEntry("old-a", { kind: "page" }),
        moveEntry("old-b", { kind: "page" }),
      ],
      [
        moveEntry("new-a", { kind: "page" }),
        moveEntry("new-b", { kind: "page" }),
      ],
      moveSignals({ similarity: (old, next) => scores[old.path]![next.path]! }),
    ),
    {
      moves: [{ kind: "page", path: "new-b", previousPath: "old-a" }],
      diagnostics: [],
    },
  );
});

test("a best-score tie is ambiguous even when only one edge is mutual", () => {
  assert.deepEqual(
    pairMoves(
      [
        moveEntry("old-a", { kind: "document" }),
        moveEntry("old-b", { kind: "document" }),
      ],
      [
        moveEntry("new-a", { kind: "document" }),
        moveEntry("new-b", { kind: "document" }),
      ],
      moveSignals({
        similarity: (old, next) =>
          next.path === "new-a" ? 0.7 : old.path === "old-b" ? 0.8 : 0.4,
      }),
    ),
    {
      moves: [{ kind: "document", path: "new-b", previousPath: "old-b" }],
      diagnostics: [
        "added document new-a matches removed entries old-a and old-b; declare movedFrom to pair it",
      ],
    },
  );
});
