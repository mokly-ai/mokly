import assert from "node:assert/strict";
import test from "node:test";

import { phaseLine } from "../packages/mokly/src/sidecar/postcss-phases.js";

test("PostCSS phase records use stable names and explicit durations", () => {
  assert.equal(
    phaseLine({
      phase: "config-load",
      event: "end",
      elapsedMs: 23,
      durationMs: 7,
    }),
    '[mokly:postcss-phase] {"phase":"config-load","event":"end","elapsedMs":23,"durationMs":7}',
  );
});

test("PostCSS module records keep the last module URL", () => {
  assert.equal(
    phaseLine({
      phase: "module",
      event: "module",
      elapsedMs: 4,
      moduleUrl: "file:///C:/fixture/postcss.mjs",
    }),
    '[mokly:postcss-phase] {"phase":"module","event":"module","elapsedMs":4,"moduleUrl":"file:///C:/fixture/postcss.mjs"}',
  );
});
