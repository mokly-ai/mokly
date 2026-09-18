import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { compileCatalogue, type Compilation } from "../dist/build/compile.js";
import { generatedViews } from "../dist/components/views.js";
import { loadConfig } from "../dist/config/load.js";
import type { ReviewResultV3 } from "../dist/review/component_types.js";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { componentChangeCases } from "./helpers/component_change_cases.js";
import {
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

for (const [name, change, routes] of componentChangeCases)
  test(`fast and complete paths agree for ${name}`, async (t) => {
    const fixture = await componentReviewFixture(t, change);
    const result = await assertFastPathEquivalent({
      before: fixture.before.manifest,
      after: fixture.after.manifest,
      beforeFiles: compilationFiles(fixture.before),
      afterFiles: compilationFiles(fixture.after),
      changedPaths: fixture.changedPaths,
      config: fixture.config,
    });
    assert.deepEqual(
      result.changes.map((entry) => (entry.after ?? entry.before)!.route),
      routes,
    );
    if (name === "screen-owned invisible data")
      assert.ok(
        result.changes.some((entry) =>
          entry.reasons.some((reason) => reason.kind === "inputs"),
        ),
      );
  });

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
  const screen = result.screens.find((entry) => entry.id === "home");
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
  test(`fast and complete paths agree for changed reachable CSS; owned=${owned}`, async (t) => {
    const fixture = await stylesheetFixture(t, owned);
    const result = await assertFastPathEquivalent(fixture);
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
          (entry) => entry.kind === "component" && entry.after?.id === "action",
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
  await fs.mkdir(path.join(fixture.mockupsDir, "components"));
  for (const route of ["image.svg", "components/image.svg"])
    await fs.writeFile(path.join(fixture.mockupsDir, route), "base-image");
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const baseImages = {
    "image.svg": "base-image",
    "components/image.svg": "base-image",
  };
  const headImages = {
    "image.svg": "head-image",
    "components/image.svg": "head-image",
  };
  const result = await assertFastPathEquivalent({
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
  const before = historicalCompilation(fixture.before);
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
      'id: "action",',
      'id: "action", ownedDependencies: ["mockups/action.css"], dependencies: ["mockups/action.css"],',
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

function historicalCompilation(compilation: Compilation): Compilation {
  const manifest = structuredClone(compilation.manifest);
  const outputs = new Map(compilation.outputs);
  for (const entry of manifest.entries)
    for (const view of generatedViews(entry)) {
      const current = compilation.outputs.get(view.path);
      assert.notEqual(current, undefined);
      for (const style of view.usage?.styles ?? []) {
        style.startOffset += historicalOffset(current!, style.startOffset);
        style.endOffset += historicalOffset(current!, style.endOffset);
      }
      outputs.set(
        view.path,
        current!
          .replaceAll("<!--mokly-component:", "<!--mokabook-component:")
          .replaceAll("<!--mokly-review-", "<!--mokabook-review-"),
      );
    }
  return { ...compilation, manifest, outputs };
}

function historicalOffset(html: string, offset: number): number {
  return (
    [...html.slice(0, offset).matchAll(/<!--mokly-(?:component|review-)/g)]
      .length * 3
  );
}

async function assetFiles(directory: string) {
  const files = new Map<string, Uint8Array>();
  for (const name of await fs.readdir(directory))
    files.set(`assets/${name}`, await fs.readFile(path.join(directory, name)));
  return files;
}

function allViews(result: ReviewResultV3) {
  return [
    ...result.screens.flatMap((screen) => screen.views),
    ...result.components.flatMap((component) =>
      component.variants.flatMap((variant) => variant.views),
    ),
  ];
}
