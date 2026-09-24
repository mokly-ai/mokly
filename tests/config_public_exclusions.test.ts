import assert from "node:assert/strict";
import test from "node:test";

import { resolveConfig } from "../dist/config/validate.js";
import { MoklyError } from "../dist/errors.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const [removed, guidance] of [
  [
    "generatedOutput",
    "use Git tracking for check and run mokly build to write output",
  ],
  ["publicExclude", "only referenced authored assets are public"],
] as const) {
  test(`${removed} is removed with actionable guidance`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    assert.throws(
      () =>
        resolveConfig(
          { entriesDir: "entries", mockupsDir: "mockups", [removed]: [] },
          fixture.configPath,
        ),
      (error: unknown) =>
        error instanceof MoklyError &&
        error.code === "config-invalid" &&
        error.message.includes(`${removed} was removed`) &&
        error.message.includes(guidance),
    );
  });
}
