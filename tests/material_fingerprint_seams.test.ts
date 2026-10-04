import assert from "node:assert/strict";
import test from "node:test";

import type {
  MaterialPiece,
  MaterialRecipe,
} from "../dist/components/material_recipe.js";
import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { fingerprintAtSeam } from "../dist/review/fingerprint_seams.js";
import { MaterialMarkerOffsets } from "../dist/review/material_marker_offsets.js";

const inspect = (source: string, recipe: MaterialRecipe) =>
  fingerprintAtSeam(source, recipe, new MaterialMarkerOffsets(source));

const insert = (text: string): MaterialPiece => ({
  kind: "insert",
  text,
  references: [],
  verbatim: true,
});

test("reserved prefixes span tiny inserts and copied pieces across several seams", () => {
  const source = "mok|line-|ordinary";
  const copied = {
    kind: "source",
    start: 4,
    end: 9,
    copy: { start: 4, end: 9 },
  } as const;
  assert.equal(
    inspect(source, [
      { kind: "source", start: 0, end: 3 },
      insert("ly-in"),
      copied,
    ]),
    true,
  );
  assert.equal(
    inspect("", [insert("mok"), insert("ly-in"), insert("line-")]),
    true,
  );
  assert.equal(
    inspect("", [insert("Mok"), insert("ly-in"), insert("line-")]),
    false,
  );
  assert.equal(
    inspect("", [insert("mok"), insert("ly-in"), insert("line_")]),
    false,
  );
  assert.equal(
    inspect(source, [
      { kind: "source", start: 0, end: 3 },
      insert("<!--placeholder-->"),
      copied,
    ]),
    false,
  );
});

test("adjacent original pieces are not newly created seams", () => {
  assert.equal(
    inspect("mokly-inline-", [
      { kind: "source", start: 0, end: 3 },
      { kind: "source", start: 3, end: 13 },
    ]),
    false,
  );
  assert.equal(
    inspect("mok|ly-inline-", [
      { kind: "source", start: 0, end: 3 },
      { kind: "source", start: 4, end: 8 },
      { kind: "source", start: 8, end: 14 },
    ]),
    true,
  );
});

test("seam windows read at most 24 UTF-16 units per seam independent of sheet size", async () => {
  const samples = [];
  for (const size of [1024, 1024 * 1024]) {
    const source = "😀".repeat(size) + "mok|ly-inline-" + "x".repeat(size);
    const offset = 2 * size;
    const events: TimingEvent[] = [];
    await runWithTimings(
      true,
      "test",
      () =>
        runWithDocumentWork(async () => {
          assert.equal(
            inspect(source, [
              { kind: "source", start: 0, end: offset + 3 },
              { kind: "source", start: offset + 4, end: source.length },
            ]),
            true,
          );
        }),
      { write: (event) => events.push(event) },
    );
    const counts = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    assert.equal(counts.fingerprintSeams, 1);
    assert.equal(counts.fingerprintSeamUnits, 24);
    samples.push(counts.fingerprintSeamUnits);
  }
  assert.equal(samples[0], samples[1]);
});

test("seeded tiny-piece joins equal full text inspection", () => {
  let seed = 0x9f123;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let trial = 0; trial < 200; trial++) {
    const text =
      trial % 2
        ? "ordinary-mokly-inline-marker"
        : "ordinary-Mokly-inline-marker";
    const pieces: MaterialPiece[] = [];
    let source = "";
    for (let offset = 0; offset < text.length;) {
      const chunk = text.slice(offset, (offset += 1 + (random() % 5)));
      if (random() % 2) pieces.push(insert(chunk));
      else {
        const start = source.length;
        source += chunk + "|";
        pieces.push({ kind: "source", start, end: source.length - 1 });
      }
      if (random() % 3 === 0) pieces.push(insert(""));
    }
    assert.ok(!source.includes("mokly-inline-"));
    assert.equal(
      inspect(source, pieces),
      text.includes("mokly-inline-"),
      `seed=0x9f123 trial=${trial}`,
    );
  }
});
