import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  runWithTimings,
  runWithDocumentWork,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageContext } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const exec = promisify(execFile);
const styles = (clock: string) =>
  `<link rel="stylesheet" href="../sheet.css"><!--mokly-review-ignore:start:clock--><meta name="clock" content="${clock}"><!--mokly-review-ignore:end:clock-->`;

for (const mode of ["committed", "derived"] as const)
  for (const owned of [false, true])
    test(`non-identical ${mode} quick attempt obeys resource-graph bound, owned=${owned}`, async (context) => {
      const fixture = await inlineChangesFixture(
        context,
        styles("one"),
        styles("two"),
        {
          colorSchemes: false,
          files: {
            before: { "sheet.css": ".entry{color:red}" },
            after: {
              "sheet.css": owned ? ".entry{color:blue}" : ".entry{color:red}",
            },
          },
        },
      );
      const input = await pageFixtureInput(fixture, mode);
      const entry = input.after.entries.find(
        ({ id }) => id === (owned ? "home" : "plain"),
      )!;
      const previous = input.before.entries.find(({ id }) => id === entry.id)!;
      const after = generatedViews(entry)[0]!;
      const before = generatedViews(previous).find(
        ({ path }) => path === after.path,
      )!;
      if (!owned) assert.equal(after.usage!.instances.length, 0);
      const events: TimingEvent[] = [];
      const result = await runWithTimings(
        true,
        "test",
        () =>
          runWithDocumentWork(() =>
            compareComponentView(pageContext(input), before, after),
          ),
        { write: (event) => events.push(event) },
      );
      assert.equal(result.comparisonPath, owned ? "complete" : "fast");
      assert.equal(
        events.filter(
          ({ stage, event }) =>
            stage === "review.resource-graph" && event === "start",
        ).length,
        owned ? 4 : mode === "committed" ? 1 : 2,
      );
    });

test("one raw pair normalization is shared and one-sided views perform none", async (context) => {
  const fixture = await inlineChangesFixture(
    context,
    styles("one"),
    styles("two"),
    {
      colorSchemes: false,
      files: {
        before: { "sheet.css": ".entry{color:red}" },
        after: { "sheet.css": ".entry{color:blue}" },
      },
    },
  );
  const input = await pageFixtureInput(fixture, "committed");
  const filename = path.join(fixture.root, "normalization-input.json");
  const textFiles = (files: ReadonlyMap<string, string | Uint8Array>) =>
    [...files].map(([route, content]) => [
      route,
      typeof content === "string"
        ? content
        : Buffer.from(content).toString("utf8"),
    ]);
  await fs.writeFile(
    filename,
    JSON.stringify({
      ...input,
      beforeFiles: textFiles(input.beforeFiles),
      afterFiles: textFiles(input.afterFiles),
    }),
  );
  for (const scenario of ["pair", "one-sided"]) {
    await context.test(scenario, async () => {
      const { stdout } = await exec(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          "--import",
          "tsx",
          "tests/helpers/page_normalization_probe.mjs",
          filename,
          scenario,
        ],
        { cwd: process.cwd() },
      );
      const result = JSON.parse(stdout);
      assert.equal(result.calls, scenario === "pair" ? 1 : 0, scenario);
    });
  }
});
