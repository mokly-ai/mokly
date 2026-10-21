import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { withFixtureEdit } from "../scripts/large/watch_edits.js";
import { WATCH_BROWSER_TIMEOUT_MS } from "../scripts/large/watch.js";

test("full-size watch allows slow React publication before timing an edit", () => {
  assert.ok(WATCH_BROWSER_TIMEOUT_MS >= 600_000);
});

test("an edit restores its source after a failed measurement", async (t) => {
  const writes: unknown[][] = [];
  t.mock.method(fs, "writeFile", async (...args: unknown[]) => {
    writes.push(args);
  });
  const error = new Error("browser failed");
  await assert.rejects(
    withFixtureEdit(
      { file: "fixture.screen.html", original: "original", changed: "edited" },
      async () => {
        throw error;
      },
    ),
    (actual) => actual === error,
  );
  assert.deepEqual(writes, [
    ["fixture.screen.html", "edited"],
    ["fixture.screen.html", "original"],
  ]);
});
