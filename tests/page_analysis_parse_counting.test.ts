import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { compilationFiles } from "./helpers/component_fast_path.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

for (const changed of [false, true])
  test(`intercept every parse5 call: ${changed ? "full fall-through" : "identical quick check"} counts original and link-normalization parses`, async (context) => {
    const fixture = await componentReviewFixture(context, (source) =>
      changed ? source.replace("Screen content", "Changed screen") : source,
    );
    const input = path.join(fixture.root, "parse-probe.json");
    await fs.writeFile(
      input,
      JSON.stringify({
        before: fixture.before.manifest,
        after: fixture.after.manifest,
        beforeFiles: [...compilationFiles(fixture.before)],
        afterFiles: [...compilationFiles(fixture.after)],
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
      steps: Record<string, number>;
    };
    assert.equal(counts.steps.pageAnalysis, counts.views + counts.complete);
    assert.equal(counts.steps.linkNormalization ?? 0, changed ? 44 : 0);
    assert.equal(
      counts.parses,
      counts.views + counts.complete + (changed ? 44 : 0),
    );
    assert.equal(counts.complete > 0, changed);
  });

test("inferred-owner references count every original and link-normalization parse", async (context) => {
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
    steps: Record<string, number>;
  };
  assert.equal(counts.complete, counts.views);
  assert.equal(counts.steps.pageAnalysis, counts.views * 2);
  assert.equal(counts.steps.linkNormalization, 92);
  assert.equal(counts.parses, 112);
});
