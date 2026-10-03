import assert from "node:assert/strict";
import test from "node:test";

import { pairMoves } from "../src/review/moves/pair.js";

import { moveEntry, moveSignals } from "./helpers/move_entries.js";

test("declared pairs win before content and reject a missing same-kind baseline", () => {
  const before = [moveEntry("old"), moveEntry("other")];
  const result = pairMoves(
    before,
    [moveEntry("new", { movedFrom: "old" })],
    moveSignals({ identical: () => true }),
  );
  assert.deepEqual(result, {
    moves: [{ kind: "screen", path: "new", previousPath: "old" }],
    diagnostics: [],
  });
  for (const movedFrom of ["missing", "document"])
    assert.deepEqual(
      pairMoves(
        [...before, moveEntry("document", { kind: "document" })],
        [moveEntry("new", { movedFrom })],
        moveSignals({ identical: () => true }),
      ),
      {
        moves: [],
        diagnostics: [
          `new: movedFrom ${movedFrom} matched no removed baseline entry of kind screen`,
        ],
      },
    );
});

test("content runs before source/title and is scoped by kind", () => {
  const before = [
    moveEntry("same-source", { title: "Guide", sourcePath: "shared.ts" }),
    moveEntry("identical"),
    moveEntry("page", { kind: "page" }),
  ];
  const result = pairMoves(
    before,
    [moveEntry("new", { title: "Guide", sourcePath: "shared.ts" })],
    moveSignals({ identical: (old) => old.path !== "same-source" }),
  );
  assert.deepEqual(result.moves, [
    { kind: "screen", path: "new", previousPath: "identical" },
  ]);
});

test("source/title pairing requires both values and excludes documents", () => {
  for (const fields of [
    {},
    { sourcePath: "different.ts" },
    { title: "Different" },
    { kind: "document" as const },
  ]) {
    const before = moveEntry("old", {
      title: "Guide",
      sourcePath: "shared.ts",
      kind: fields.kind ?? "screen",
    });
    const after = moveEntry("new", {
      title: "Guide",
      sourcePath: "shared.ts",
      ...fields,
    });
    assert.equal(
      pairMoves([before], [after], moveSignals()).moves.length,
      Object.keys(fields).length === 0 ? 1 : 0,
    );
  }
});

test("added ambiguity names every UTF-16-sorted match and blocks later signals", () => {
  const before = [moveEntry("z"), moveEntry("A"), moveEntry("a-path")];
  const result = pairMoves(
    before,
    [moveEntry("new", { sourcePath: before[0]!.sourcePath, title: "z" })],
    moveSignals({ identical: () => true }),
  );
  assert.deepEqual(result, {
    moves: [],
    diagnostics: [
      "added screen new matches removed entries A and a-path and z; declare movedFrom to pair it",
    ],
  });
});

test("removed ambiguity cannot choose one added entry or pair in a later pass", () => {
  assert.deepEqual(
    pairMoves(
      [moveEntry("old")],
      [
        moveEntry("new-b"),
        moveEntry("new-a", {
          title: "old",
          sourcePath: "specs/old.mockup.tsx",
        }),
      ],
      moveSignals({ identical: () => true }),
    ),
    {
      moves: [],
      diagnostics: [
        "removed screen old matches added entries new-a and new-b; declare movedFrom to pair it",
      ],
    },
  );
});

test("same source and title wins before a better similarity score", () => {
  const common = {
    kind: "page" as const,
    title: "Guide",
    sourcePath: "shared.ts",
  };
  const result = pairMoves(
    [moveEntry("source", common), moveEntry("similar", { kind: "page" })],
    [moveEntry("new", common)],
    moveSignals({
      similarity: (before) => (before.path === "similar" ? 1 : 0.5),
    }),
  );
  assert.deepEqual(result.moves, [
    { kind: "page", path: "new", previousPath: "source" },
  ]);
});

test("a moved parent pairs same-slug variants before later signals", () => {
  for (const kind of ["screen", "component"] as const) {
    const result = pairMoves(
      [
        moveEntry("old", { kind }),
        moveEntry("old/primary", { kind, variantOf: "old" }),
        moveEntry("old/extra", { kind, variantOf: "old" }),
      ],
      [
        moveEntry("new", { kind, movedFrom: "old" }),
        moveEntry("new/primary", { kind, variantOf: "new" }),
        moveEntry("new/renamed", { kind, variantOf: "new" }),
      ],
      moveSignals({
        identical: (old, next) =>
          old.path.endsWith("extra") && next.path.endsWith("renamed"),
      }),
    );
    assert.deepEqual(result.moves, [
      { kind, path: "new", previousPath: "old" },
      { kind, path: "new/primary", previousPath: "old/primary" },
      { kind, path: "new/renamed", previousPath: "old/extra" },
    ]);
  }
});

test("an automatic parent pair resolves same-slug children before their content ambiguity", () => {
  const entries = (parent: string) => [
    moveEntry(parent, { kind: "component" }),
    ...["primary", "secondary"].map((slug) =>
      moveEntry(`${parent}/${slug}`, { kind: "component", variantOf: parent }),
    ),
  ];
  assert.deepEqual(
    pairMoves(
      entries("old"),
      entries("new"),
      moveSignals({ identical: () => true }),
    ),
    {
      moves: [
        { kind: "component", path: "new", previousPath: "old" },
        { kind: "component", path: "new/primary", previousPath: "old/primary" },
        {
          kind: "component",
          path: "new/secondary",
          previousPath: "old/secondary",
        },
      ],
      diagnostics: [],
    },
  );
});

test("later signals receive the already accepted move map", () => {
  const result = pairMoves(
    [moveEntry("target"), moveEntry("linker")],
    [
      moveEntry("next-target", { movedFrom: "target" }),
      moveEntry("next-linker"),
    ],
    moveSignals({
      identical: (old, next, moves) =>
        old.path === "linker" &&
        next.path === "next-linker" &&
        moves.some(
          (move) =>
            move.previousPath === "target" && move.path === "next-target",
        ),
    }),
  );
  assert.equal(result.moves.length, 2);
});

test("same case-folded identities and component shape changes are not move candidates", () => {
  assert.deepEqual(
    pairMoves(
      [moveEntry("Guide"), moveEntry("part", { kind: "component" })],
      [
        moveEntry("guide"),
        moveEntry("part", { kind: "component", variantOf: "parent" }),
      ],
      moveSignals({ identical: () => true }),
    ),
    { moves: [], diagnostics: [] },
  );
  assert.deepEqual(
    pairMoves(
      [moveEntry("part", { kind: "component" })],
      [moveEntry("parent/part", { kind: "component", variantOf: "parent" })],
      moveSignals({ identical: () => true, similarity: () => 1 }),
    ).moves,
    [],
  );
});

test("different-kind path reuse stays eligible as a removed move candidate", () => {
  assert.deepEqual(
    pairMoves(
      [moveEntry("old")],
      [moveEntry("old", { kind: "page" }), moveEntry("new")],
      moveSignals({ identical: () => true }),
    ).moves,
    [{ kind: "screen", path: "new", previousPath: "old" }],
  );
});
