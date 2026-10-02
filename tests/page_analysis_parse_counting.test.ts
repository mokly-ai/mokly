import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

for (const changed of [false, true])
  test(`intercept every parse5 call: ${changed ? "full fall-through" : "identical quick check"} parses originals only, once per side`, async (context) => {
    const fixture = await componentReviewFixture(context, (source) =>
      changed ? source.replace("Screen content", "Changed screen") : source,
    );
    const input = path.join(fixture.root, "parse-probe.json");
    await fs.writeFile(
      input,
      JSON.stringify({
        before: fixture.before.manifest,
        after: fixture.after.manifest,
        beforeFiles: [...fixture.before.outputs],
        afterFiles: [...fixture.after.outputs],
        changedPaths: fixture.changedPaths,
        config: fixture.config,
      }),
    );
    const result = await promisify(execFile)(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        "--import",
        "tsx",
        fileURLToPath(
          new URL("./helpers/page_parse_probe.mjs", import.meta.url),
        ),
        input,
      ],
      { timeout: 30_000 },
    );
    const counts = JSON.parse(result.stdout) as {
      parses: number;
      views: number;
      complete: number;
    };
    assert.equal(counts.parses, counts.views + counts.complete);
    assert.equal(counts.complete > 0, changed);
  });

test("every parse5 call stays on original pages when inferred owners traverse CSS references", async (context) => {
  const fixture = await inlineChangesFixture(
    context,
    '<style>.actual-only{background:url("../owned.svg")}</style>',
    '<style>.actual-only{background:url("../owned.svg")}.entry{color:blue}</style>',
    {
      colorSchemes: false,
      files: {
        before: { "owned.svg": "before" },
        after: { "owned.svg": "after" },
      },
    },
  );
  const fixtureInput = await pageFixtureInput(fixture, "derived");
  const input = path.join(fixture.root, "parse-probe.json");
  const files = (values: ReadonlyMap<string, string | Uint8Array>) =>
    [...values].map(([route, text]) => [route, Buffer.from(text).toString()]);
  await fs.writeFile(
    input,
    JSON.stringify({
      ...fixtureInput,
      beforeFiles: files(fixtureInput.beforeFiles),
      afterFiles: files(fixtureInput.afterFiles),
    }),
  );
  const result = await promisify(execFile)(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      fileURLToPath(new URL("./helpers/page_parse_probe.mjs", import.meta.url)),
      input,
    ],
    { timeout: 30_000 },
  );
  const counts = JSON.parse(result.stdout) as {
    parses: number;
    views: number;
    complete: number;
  };
  assert.equal(counts.complete, counts.views);
  assert.equal(counts.parses, counts.views * 2);
});
