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
