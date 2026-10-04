import assert from "node:assert/strict";
import test from "node:test";

import { fingerprintAtSeam } from "../dist/review/fingerprint_seams.js";
import { MaterialMarkerOffsets } from "../dist/review/material_marker_offsets.js";
import { StyleSeamOffsets } from "../dist/review/style_seam_offsets.js";

import { fingerprintRandom } from "./helpers/fingerprint_random.js";
import {
  crossingStyleOccurrences,
  randomStyleRecipe,
  styleRecipeKinds,
} from "./helpers/fingerprint_style_recipes.js";

test("seeded style-copy admission never misses brute-force crossings across recipes", (context) => {
  const seed = 0xa190c3;
  const random = fingerprintRandom(seed);
  const seen = new Map<
    string,
    { crossing: number; guarded: number; admitted: number }
  >();
  context.diagnostic(`seed=0x${seed.toString(16)}`);
  for (let trial = 0; trial < 12_000; trial++) {
    const { kind, source, recipe, styles } = randomStyleRecipe(trial, random);
    const crossing = crossingStyleOccurrences(source, recipe, styles);
    const guarded = fingerprintAtSeam(
      source,
      recipe,
      new MaterialMarkerOffsets(source),
      new StyleSeamOffsets(source, styles),
    );
    const count = seen.get(kind) ?? { crossing: 0, guarded: 0, admitted: 0 };
    count.crossing += Number(crossing > 0);
    count.guarded += Number(guarded);
    count.admitted += Number(!guarded);
    seen.set(kind, count);
    assert.ok(
      !crossing || guarded,
      `seed=0x${seed.toString(16)} trial=${trial} kind=${kind} missed=${crossing}`,
    );
  }
  assert.deepEqual([...seen.keys()].sort(), [...styleRecipeKinds].sort());
  for (const kind of styleRecipeKinds.filter((kind) => kind !== "adjacent"))
    assert.ok(
      seen.get(kind)!.crossing > 0,
      `${kind} must exercise an actual crossing`,
    );
  assert.equal(seen.get("adjacent")!.crossing, 0);
  assert.equal(seen.get("adjacent")!.admitted, 2000);
  context.diagnostic(JSON.stringify(Object.fromEntries(seen)));
});

test("whole endings are paired with the length of the same skipped source", () => {
  const a = "<style>.a{color:red}</style>";
  const b = "<style>.longer{padding:100px;color:blue}</style>";
  const prefix = "<style>" + "x".repeat(a.length - 7 - 12);
  const source = prefix + "|" + b.slice(-12);
  assert.equal(
    fingerprintAtSeam(
      source,
      [
        { kind: "source", start: 0, end: prefix.length },
        { kind: "source", start: prefix.length + 1, end: source.length },
      ],
      new MaterialMarkerOffsets(source),
      new StyleSeamOffsets(source, [a, b]),
    ),
    false,
  );
});

test("an inserted ending at the wrong material position does not reject fingerprints", () => {
  const wrapper = '<mokly-caller-slot data-key="k1" data-rendered="true">';
  const style = `<style>.entry{color:red}</style data-copy=${wrapper}`;
  const source = style.slice(0, -wrapper.length) + "x";
  assert.equal(
    fingerprintAtSeam(
      source,
      [
        { kind: "source", start: 0, end: source.length },
        { kind: "insert", text: wrapper, references: [] },
      ],
      new MaterialMarkerOffsets(source),
      new StyleSeamOffsets(source, [style]),
    ),
    false,
  );
});
