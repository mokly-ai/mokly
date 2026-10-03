import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { withoutDeliveredSourceImpact } from "../dist/review/imported_changes.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("one changed generated stylesheet strips every delivered CSS source's shared impact", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.deepEqual(
    withoutDeliveredSourceImpact(
      ["entries/first.css", "entries/second.css", "entries/helper.ts"],
      ["mockups/mokly-generated/styles/entries/first.mockup.ts.css"],
      new Set(["entries/first.css", "entries/second.css"]),
      config,
    ),
    ["entries/helper.ts"],
  );
});
