import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { compileCatalogue, type Compilation } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import type { ReviewResultV5 } from "../packages/viewer/dist/review/component_types.js";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { componentChangeCases } from "./helpers/component_change_cases.js";
import {
  assertComparisonModesEquivalent,
  assertFastPathEquivalent,
  compilationFiles,
  type FastPathFixture,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

for (const [name, change, routes] of componentChangeCases) {
  const settlesFast = ![
    "component-only implementation",
    "component and screen edits",
  ].includes(name);
  test(`${settlesFast ? "fast and complete paths" : "enabled and forced-complete modes"} agree for ${name}`, async (t) => {
    const fixture = await componentReviewFixture(t, change);
    const result = await (
      settlesFast ? assertFastPathEquivalent : assertComparisonModesEquivalent
    )({
      before: fixture.before.manifest,
      after: fixture.after.manifest,
      beforeFiles: compilationFiles(fixture.before),
      afterFiles: compilationFiles(fixture.after),
      changedPaths: fixture.changedPaths,
      config: fixture.config,
    });
    assert.deepEqual(
      result.changes.map((entry) => (entry.after ?? entry.before)!.path),
      routes,
    );
    if (name === "screen-owned invisible data")
      assert.ok(
        result.changes.some((entry) =>
          entry.reasons.some((reason) => reason.kind === "inputs"),
        ),
      );
  });
}

test("fast and complete paths agree for ignored-only documents", async (t) => {
  const source = componentEntrySource({
    body: '<ReviewIgnore id="notice">Before</ReviewIgnore><action.Component label="Visible" />',
  });
  const fixture = await componentReviewFixture(
    t,
    (current) => current.replaceAll("Before", "After"),
    source,
  );
  const result = await assertFastPathEquivalent({
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeFiles: compilationFiles(fixture.before),
    afterFiles: compilationFiles(fixture.after),
    changedPaths: fixture.changedPaths,
    config: fixture.config,
  });
  const screen = result.screens.find((entry) => entry.path === "home");
  assert.ok(screen);
  assert.ok(screen.views.every((view) => view.state === "ignored-only"));
  assert.ok(
    screen.views.every(
      (view) =>
        view.ignoredIds.includes("notice") &&
        !view.material &&
        !view.reasons &&
        !view.excludedResources,
    ),
  );
});

for (const owned of [false, true])
  test(`enabled and forced-complete modes agree for changed reachable CSS; owned=${owned}`, async (t) => {
    const fixture = await stylesheetFixture(t, owned);
    const result = await assertComparisonModesEquivalent(fixture);
    assert.ok(
      allViews(result).some(
        (view) =>
          view.reasons?.some(
            (reason) => reason.path === "mockups/action.css",
          ) ||
          view.excludedResources?.some(
            (resource) => resource.path === "mockups/action.css",
          ),
      ),
    );
    if (owned) {
      assert.ok(
        result.changes.some(
          (entry) =>
            entry.kind === "component" && entry.after?.path === "action",
        ),
      );
      assert.ok(
        result.affectedConsumers.some(
          (entry) => entry.changedComponentId === "action",
        ),
      );
    }
  });

test("derived byte-only image changes take the complete path", async (t) => {
  const source = componentEntrySource({
    actionRender:
      '(props) => <button>{props.label}<img src="../image.svg" /></button>',
  });
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  const images = ["image.svg", "action/image.svg", "pane/image.svg"];
  for (const route of images) {
    await fs.mkdir(path.dirname(path.join(fixture.mockupsDir, route)), {
      recursive: true,
    });
    await fs.writeFile(path.join(fixture.mockupsDir, route), "base-image");
  }
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const baseImages = Object.fromEntries(
    images.map((image) => [image, "base-image"]),
  );
  const headImages = Object.fromEntries(
    images.map((image) => [image, "head-image"]),
  );
  const result = await assertComparisonModesEquivalent({
    before: compilation.manifest,
    after: compilation.manifest,
    beforeFiles: compilationFiles(compilation, baseImages),
    afterFiles: compilationFiles(compilation, headImages),
    changedPaths: [],
    config: { ...config, generatedOutput: "derived" },
  });
  assert.ok(
    result.changes.some((entry) =>
      entry.reasons.some((reason) => reason.kind === "material"),
    ),
  );
});

test("historical component markers remain unchanged", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const before = baselineCompilation(fixture.before);
  const result = await assertFastPathEquivalent({
    before: before.manifest,
    after: fixture.after.manifest,
    beforeFiles: compilationFiles(before),
    afterFiles: compilationFiles(fixture.after),
    changedPaths: [],
    config: fixture.config,
  });
  assert.ok(result.screens.every((entry) => entry.state === "unchanged"));
  assert.ok(result.components.every((entry) => entry.state === "unchanged"));
});

test("fast and complete paths agree on the small large-catalogue fixture", async (t) => {
  await fs.mkdir(path.join(repositoryRoot, ".context"), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-fast-path-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await generateLargeFixture(root, { areas: 2, screens: 4, rows: 3 });
  const config = await loadConfig(root);
  const compilation = await compileCatalogue(config);
  const resources = await assetFiles(path.join(root, "mockups/assets"));
  const result = await assertFastPathEquivalent({
    before: compilation.manifest,
    after: compilation.manifest,
    beforeFiles: new Map([...compilationFiles(compilation), ...resources]),
    afterFiles: new Map([...compilationFiles(compilation), ...resources]),
    changedPaths: [],
    config,
  });
  assert.ok(result.screens.every((entry) => entry.state === "unchanged"));
  assert.ok(result.components.every((entry) => entry.state === "unchanged"));
});

async function stylesheetFixture(
  t: TestContext,
  owned: boolean,
): Promise<FastPathFixture> {
  let source = componentEntrySource().replace(
    "<button data-viewport=",
    '<button className="action" data-viewport=',
  );
  if (owned)
    source = source.replace(
      'path: "action",',
      'path: "action", ownedDependencies: ["mockups/action.css"], dependencies: ["mockups/action.css"],',
    );
  const fixture = await createFixture(source, {
    extraConfig:
      'colorSchemes: ["light", "dark"], stylesheets: [{ match: "**/*.html", stylesheets: ["action.css"] }],',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "action.css"), "");
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  const after = await compileCatalogue(config);
  return {
    before: before.manifest,
    after: after.manifest,
    beforeFiles: compilationFiles(before, {
      "action.css": ".action{color:red}",
    }),
    afterFiles: compilationFiles(after, {
      "action.css": ".action{color:green}",
    }),
    changedPaths: ["mockups/action.css"],
    config,
  };
}

function baselineCompilation(compilation: Compilation): Compilation {
  return {
    ...compilation,
    manifest: structuredClone(compilation.manifest),
    outputs: new Map(compilation.outputs),
  };
}

async function assetFiles(directory: string) {
  const files = new Map<string, Uint8Array>();
  for (const name of await fs.readdir(directory))
    files.set(`assets/${name}`, await fs.readFile(path.join(directory, name)));
  return files;
}

function allViews(result: ReviewResultV5) {
  return [
    ...result.screens.flatMap((screen) => screen.views),
    ...result.components.flatMap((component) =>
      component.variants.flatMap((variant) => variant.views),
    ),
  ];
}
