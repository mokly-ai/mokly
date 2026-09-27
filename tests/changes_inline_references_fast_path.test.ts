import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { LightningCssRuleParser } from "../dist/review/css/rules.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import {
  assertFastPathEquivalent,
  compilationFiles,
  memoryReader,
} from "./helpers/component_fast_path.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  inlineComponentSource,
  inlineRenderer,
} from "./helpers/inline_changes.js";

for (const mode of ["committed", "derived"] as const)
  for (const [name, selector, expected] of [
    ["owned", ".actual-only", ["components/action.html"]],
    ["excluded", ".unused", []],
    ["entry", ".entry", ["screens/home.html"]],
  ] as const)
    test(`${mode} fast and complete paths agree for an ${name} inline image`, async (t) => {
      const fixture = await referenceFixture(t, selector);
      const result = await assertFastPathEquivalent({
        before: fixture.compilation.manifest,
        after: fixture.compilation.manifest,
        beforeFiles: compilationFiles(fixture.compilation, {
          "image.svg": "before-image",
          "components/image.svg": "component-image",
        }),
        afterFiles: compilationFiles(fixture.compilation, {
          "image.svg": "after-image",
          "components/image.svg": "component-image",
        }),
        changedPaths: mode === "committed" ? ["mockups/image.svg"] : [],
        config: { ...fixture.config, generatedOutput: mode },
      });
      assert.deepEqual(
        result.changes.map((entry) => entry.after?.route),
        expected,
      );
      if (mode === "derived")
        for (const entry of result.changes)
          assert.ok(entry.reasons.some((reason) => reason.kind === "material"));
    });

test("fast-path reference analysis parses cached CSS once and prepares each view once", async (t) => {
  const fixture = await referenceFixture(t, ".actual-only");
  const parser = new LightningCssRuleParser();
  let parseCount = 0;
  const beforeFiles = compilationFiles(fixture.compilation, {
    "image.svg": "before-image",
    "components/image.svg": "component-image",
  });
  const afterFiles = compilationFiles(fixture.compilation, {
    "image.svg": "after-image",
    "components/image.svg": "component-image",
  });
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "test",
    () =>
      classifyComponents({
        before: fixture.compilation.manifest,
        after: fixture.compilation.manifest,
        beforeReader: memoryReader(beforeFiles),
        afterReader: memoryReader(afterFiles),
        config: fixture.config,
        changedPaths: ["mockups/image.svg"],
        baseCommit: "a".repeat(40),
        baseRef: "main",
        cssParser: {
          parse: (source) => {
            parseCount += 1;
            return parser.parse(source);
          },
        },
      }),
    { write: (event) => events.push(event) },
  );
  assert.equal(parseCount, 1);
  const views = fixture.compilation.manifest.entries.reduce(
    (count, entry) => count + generatedViews(entry).length,
    0,
  );
  assert.equal(
    events.filter(
      (event) =>
        event.stage === "review.inline-style-analysis" &&
        event.event === "start",
    ).length,
    views,
  );
});

async function referenceFixture(t: TestContext, selector: string) {
  const fixture = await createFixture(inlineComponentSource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  const styles = `<style>${selector}{background:url("../image.svg")}</style>`;
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    inlineRenderer(styles),
  );
  await fs.mkdir(path.join(fixture.mockupsDir, "components"));
  await fs.writeFile(path.join(fixture.mockupsDir, "image.svg"), "image");
  await fs.writeFile(
    path.join(fixture.mockupsDir, "components/image.svg"),
    "component-image",
  );
  const config = await loadConfig(fixture.root);
  return { compilation: await compileCatalogue(config), config };
}
