import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { compileCatalogue, type Compilation } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import {
  assertComparisonModesEquivalent,
  assertFastPathEquivalent,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

for (const direction of ["added", "removed"] as const)
  test(`derived ${direction} stylesheet imports agree across enabled and forced-complete modes`, async (t) => {
    const fixture = await componentReviewFixture(t, (source) => source);
    const baseCss = direction === "added" ? "" : '@import "./nested.css";';
    const headCss = direction === "added" ? '@import "./nested.css";' : "";
    const result = await assertComparisonModesEquivalent({
      before: fixture.before.manifest,
      after: fixture.after.manifest,
      beforeFiles: withRootStylesheet(fixture.before, {
        "main.css": baseCss,
        ...(direction === "removed" ? { "nested.css": "base" } : {}),
      }),
      afterFiles: withRootStylesheet(fixture.after, {
        "main.css": headCss,
        ...(direction === "added" ? { "nested.css": "head" } : {}),
      }),
      changedPaths: [],
      config: { ...fixture.config, generatedOutput: "derived" },
    });
    assert.ok(
      result.changes.some((entry) =>
        entry.reasons.some((reason) => reason.kind === "material"),
      ),
    );
  });

for (const generatedOutput of ["derived", "committed"] as const)
  test(`source-only formatting preserves component artifact paths in ${generatedOutput} mode`, async (t) => {
    const fixture = await relocatedFixture(t);
    const beforePath = actionViewPath(fixture.before);
    const afterPath = actionViewPath(fixture.after);
    assert.equal(beforePath, afterPath);
    assert.equal(
      textOutput(fixture.before.outputs, beforePath),
      textOutput(fixture.after.outputs, afterPath),
    );
    const changedPaths = ["entries/fixture.mockup.tsx"];
    if (generatedOutput === "committed")
      changedPaths.push(
        "mockups/image.svg",
        "mockups/action/image.svg",
        "mockups/pane/image.svg",
      );
    const images = ["image.svg", "action/image.svg", "pane/image.svg"];
    const beforeResources = Object.fromEntries(
      images.map((image) => [image, "image"]),
    );
    const afterResources = Object.fromEntries(
      images.map((image) => [
        image,
        generatedOutput === "committed" ? "updated" : "image",
      ]),
    );
    const result = await (
      generatedOutput === "derived"
        ? assertFastPathEquivalent
        : assertComparisonModesEquivalent
    )({
      before: fixture.before.manifest,
      after: fixture.after.manifest,
      beforeFiles: compilationFiles(fixture.before, beforeResources),
      afterFiles: compilationFiles(fixture.after, afterResources),
      changedPaths,
      config: { ...fixture.config, generatedOutput },
    });
    assert.equal(
      result.components.find((component) => component.path === "action")?.state,
      generatedOutput === "committed" ? "changed" : "unchanged",
    );
  });

async function relocatedFixture(t: TestContext) {
  const source = componentEntrySource({
    actionRender:
      '(props) => <button>{props.label}<img src="../image.svg" /></button>',
  });
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  for (const route of ["image.svg", "action/image.svg", "pane/image.svg"]) {
    await fs.mkdir(path.dirname(path.join(fixture.mockupsDir, route)), {
      recursive: true,
    });
    await fs.writeFile(path.join(fixture.mockupsDir, route), "image");
  }
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(
    fixture.entryPath,
    source.replace('path: "action",', 'path: "action", '),
  );
  const after = await compileCatalogue(config);
  return { before, after, config };
}

function actionViewPath(compilation: Compilation): string {
  const action = compilation.manifest.entries.find(
    (entry) => entry.kind === "component" && entry.path === "action/default",
  );
  assert.ok(action);
  return generatedViews(action)[0]!.path;
}

function withRootStylesheet(
  compilation: Compilation,
  resources: Readonly<Record<string, string>>,
) {
  return new Map(
    [...compilationFiles(compilation, resources)].map(([route, value]) => [
      route,
      route.endsWith(".html")
        ? `${Buffer.from(value).toString("utf8")}<link rel="stylesheet" href="${path.posix.relative(path.posix.dirname(route), "main.css")}">`
        : value,
    ]),
  );
}
