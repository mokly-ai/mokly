import assert from "node:assert/strict";
import test from "node:test";

import { pairMoves } from "../src/review/moves/pair.js";
import type { MoveCandidate } from "../src/review/moves/types.js";

import { moveEntry, moveSignals } from "./helpers/move_entries.js";

test("identical-content passes repeat until linked entries and their flow pair", () => {
  const before = [
    moveEntry("detail"),
    moveEntry("home"),
    moveEntry("tour", { kind: "use-case" }),
  ];
  const after = [
    moveEntry("next-detail"),
    moveEntry("next-home"),
    moveEntry("next-tour", { kind: "use-case" }),
  ];
  const result = pairMoves(
    before,
    after,
    moveSignals({
      identical(old, next, moves) {
        if (next.path !== `next-${old.path}`) return false;
        return (
          old.path === "detail" ||
          moves.some(
            (move) =>
              move.previousPath === (old.path === "home" ? "detail" : "home"),
          )
        );
      },
    }),
  );
  assert.equal(result.moves.length, 3);
  assert.deepEqual(result.diagnostics, []);
});

test("unique fingerprint groups keep full content comparisons linear", () => {
  const count = 200;
  const before = Array.from({ length: count }, (_, index) =>
    moveEntry(`old/item-${index}`, { title: `Content ${index}` }),
  );
  const after = Array.from({ length: count }, (_, index) =>
    moveEntry(`new/item-${index}`, { title: `Content ${index}` }),
  );
  let comparisons = 0;
  const signals = {
    ...moveSignals(),
    fingerprint(entry: MoveCandidate) {
      return { hash: entry.title, ignores: "" };
    },
    identical(left: MoveCandidate, right: MoveCandidate) {
      comparisons++;
      return left.title === right.title;
    },
  };
  const result = pairMoves(before, after, signals);
  assert.equal(result.moves.length, count);
  assert.ok(
    comparisons <= count * 2,
    `expected linear comparisons, observed ${comparisons}`,
  );
});

test("production fingerprints require linear full comparisons for unique rendered pages", async () => {
  const { contentMoveSignals } = await import("../src/review/moves/content.js");
  const count = 200;
  const make = (folder: string) =>
    Array.from({ length: count }, (_, index) => ({
      ...moveEntry(`${folder}/item-${index}`, { kind: "page" }),
      kind: "page" as const,
      description: "Page",
      relatedDocs: [],
    }));
  const before = make("old"),
    after = make("new");
  const documents = (entries: typeof before) =>
    new Map(
      entries.map((entry, index) => [
        `mokly-generated/${entry.path}/index.html`,
        `<h1>Page ${index}</h1><p>${"Long unique content ".repeat(300)}</p>`,
      ]),
    );
  const signals = contentMoveSignals(
    before,
    after,
    documents(before),
    documents(after),
  );
  let comparisons = 0;
  const pairing = pairMoves(before, after, {
    ...signals,
    identical(...args) {
      comparisons++;
      return signals.identical(...args);
    },
  });
  assert.equal(pairing.moves.length, count);
  assert.equal(comparisons, count);
});

test("different ignore contracts fall back to paired normalization before excluding a match", async () => {
  const { contentMoveSignals } = await import("../src/review/moves/content.js");
  const entry = (path: string) => ({
    ...moveEntry(path, { kind: "page" }),
    kind: "page" as const,
    description: "Page",
    relatedDocs: [],
  });
  const before = entry("old"),
    after = entry("new");
  const base =
    "<!--mokly-review-ignore:start:clock-->same<!--mokly-review-ignore:end:clock-->";
  const signals = contentMoveSignals(
    [before],
    [after],
    new Map([["mokly-generated/old/index.html", base]]),
    new Map([["mokly-generated/new/index.html", "same"]]),
  );
  assert.equal(pairMoves([before], [after], signals).moves.length, 1);
});
