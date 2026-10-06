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

import { assertComparisonPaths } from "./helpers/component_comparison_paths.js";
import {
  assertComparisonModesEquivalent,
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
    ["owned", ".actual-only", ["action"]],
    ["excluded", ".unused", []],
    ["entry", ".entry", ["home"]],
  ] as const)
    test(`${mode} enabled and forced-complete paths agree for an ${name} changed inline image`, async (t) => {
      const fixture = await referenceFixture(t, selector);
      const input = {
        before: fixture.compilation.manifest,
        after: fixture.compilation.manifest,
        beforeFiles: compilationFiles(fixture.compilation, {
          "image.svg": "before-image",
        }),
        afterFiles: compilationFiles(fixture.compilation, {
          "image.svg": "after-image",
        }),
        changedPaths: mode === "committed" ? ["mockups/image.svg"] : [],
        config: { ...fixture.config, generatedOutput: mode },
      };
      await assertComparisonPaths(input, "complete");
      const result = await assertComparisonModesEquivalent(input);
      assert.deepEqual(
        result.changes.map((entry) => entry.after?.path),
        expected,
      );
      if (mode === "derived")
        for (const entry of result.changes)
          assert.ok(entry.reasons.some((reason) => reason.kind === "material"));
    });

for (const mode of ["committed", "derived"] as const)
  for (const [name, selector] of [
    ["owned", ".actual-only"],
    ["excluded", ".unused"],
    ["entry", ".entry"],
  ] as const)
    test(`${mode} every view takes the fast path for an ${name} unchanged inline image`, async (t) => {
      const fixture = await referenceFixture(t, selector);
      const files = compilationFiles(fixture.compilation, {
        "image.svg": "same-image",
      });
      const input = {
        before: fixture.compilation.manifest,
        after: fixture.compilation.manifest,
        beforeFiles: files,
        afterFiles: files,
        changedPaths: [],
        config: { ...fixture.config, generatedOutput: mode },
      };
      await assertComparisonPaths(input, "fast");
      const result = await assertFastPathEquivalent(input);
      assert.deepEqual(result.changes, []);
    });

for (const mode of ["committed", "derived"] as const)
  test(`${mode} mixed inline references use per-view paths and cached preparation`, async (t) => {
    const fixture = await referenceFixture(t, ".actual-only", true);
    const parser = new LightningCssRuleParser();
    const parseCounts = new Map<string, number>();
    const beforeFiles = compilationFiles(fixture.compilation, {
      "image.svg": "before-image",
      "other.svg": "same-image",
    });
    const afterFiles = compilationFiles(fixture.compilation, {
      "image.svg": "after-image",
      "other.svg": "same-image",
    });
    const input = {
      before: fixture.compilation.manifest,
      after: fixture.compilation.manifest,
      beforeFiles,
      afterFiles,
      config: { ...fixture.config, generatedOutput: mode },
      changedPaths: mode === "committed" ? ["mockups/image.svg"] : [],
    };
    await assertComparisonPaths(input, "complete", ["home"], 1);
    await assertComparisonPaths(
      input,
      "fast",
      fixture.compilation.manifest.entries
        .filter((entry) => entry.path !== "home")
        .map((entry) => entry.path),
      0,
    );
    const events: TimingEvent[] = [];
    const result = await runWithTimings(
      true,
      "test",
      () =>
        classifyComponents({
          before: fixture.compilation.manifest,
          after: fixture.compilation.manifest,
          beforeReader: memoryReader(beforeFiles),
          afterReader: memoryReader(afterFiles),
          config: input.config,
          changedPaths: input.changedPaths,
          baseCommit: "a".repeat(40),
          baseRef: "main",
          cssParser: {
            parse: (source) => {
              parseCounts.set(source, (parseCounts.get(source) ?? 0) + 1);
              return parser.parse(source);
            },
          },
        }),
      { write: (event) => events.push(event) },
    );
    assert.deepEqual(Object.fromEntries(parseCounts), {
      '.actual-only{background:url("../image.svg")}': 1,
    });
    assert.deepEqual(result, await assertComparisonModesEquivalent(input));
    assert.deepEqual(
      result.changes.map((entry) => entry.after?.path),
      ["action"],
    );
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
      2,
    );
    const counts = events.find(
      (event) =>
        event.stage === "review.compare-screens" && event.event === "counts",
    )?.counts;
    assert.equal(views, 10);
    assert.equal(counts?.fastPath, 8);
    assert.equal(counts?.completePath, 2);
  });

async function referenceFixture(
  t: TestContext,
  selector: string,
  mixed = false,
) {
  const fixture = await createFixture(inlineComponentSource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  const styles = `<style>${selector}{background:url("../image.svg")}</style>`;
  const renderer = mixed
    ? `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head>' + (input.entry.path === "home" ? ${JSON.stringify(styles)} : ${JSON.stringify(styles.replace("../image.svg", "../other.svg"))}).replaceAll('../', '../'.repeat(input.entry.path.split('/').length)) + '</head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`
    : inlineRenderer(styles);
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), renderer);
  await fs.writeFile(path.join(fixture.mockupsDir, "image.svg"), "image");
  if (mixed)
    await fs.writeFile(path.join(fixture.mockupsDir, "other.svg"), "image");
  const config = await loadConfig(fixture.root);
  return { compilation: await compileCatalogue(config), config };
}
