import assert from "node:assert/strict";
import test from "node:test";

import {
  focusedExampleConfigSource,
  staticExampleEntrySource,
} from "./helpers/example_baseline.js";
import { optedOutFixtureSource } from "./helpers/interactive_server.js";

test("fixture source rewrites fail loudly when expected text is absent", () => {
  const completeExceptBaseline = `export default defineConfig({
  roots: [
    { dir: "specs" },
  ],
});`;

  assert.throws(
    () => focusedExampleConfigSource("", []),
    /generatedOutput insertion.*was absent/u,
  );
  assert.throws(
    () => focusedExampleConfigSource("export default defineConfig({", []),
    /roots array.*was absent/u,
  );
  assert.throws(
    () => focusedExampleConfigSource(completeExceptBaseline, []),
    /baselineBuild removal.*was absent/u,
  );
  assert.throws(
    () => staticExampleEntrySource(""),
    /static-example design link.*was absent/u,
  );
  assert.throws(
    () => optedOutFixtureSource(""),
    /interactive opt-out.*was absent/u,
  );
});
