import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { compileCatalogue, type Compilation } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { normalizeDocumentUrls } from "../dist/review/normalize_urls.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import {
  assertFastPathEquivalent,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const direction of ["added", "removed"] as const)
  test(`derived ${direction} stylesheet imports agree across paths`, async (t) => {
    const fixture = await componentReviewFixture(t, (source) => source);
    const baseCss = direction === "added" ? "" : '@import "./nested.css";';
    const headCss = direction === "added" ? '@import "./nested.css";' : "";
    const result = await assertFastPathEquivalent({
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
      config: fixture.config,
    });
    assert.ok(
      result.changes.some((entry) =>
        entry.reasons.some((reason) => reason.kind === "material"),
      ),
    );
  });

test("relocated views use the complete in-memory path", async (t) => {
  const fixture = await relocatedFixture(t);
  const beforePath = actionViewPath(fixture.before);
  const afterPath = actionViewPath(fixture.after);
  assert.notEqual(beforePath, afterPath);
  assert.equal(
    normalizeDocumentUrls(
      fixture.before.outputs.get(beforePath)!,
      beforePath,
      ".generated",
    ),
    normalizeDocumentUrls(
      fixture.after.outputs.get(afterPath)!,
      afterPath,
      ".generated",
    ),
  );
  const changedPaths = ["entries/fixture.mockup.tsx"];
  const beforeResources = {
    "image.svg": "image",
    "components/image.svg": "image",
  };
  const afterResources = {
    ...beforeResources,
    "components/nested/image.svg": "image",
  };
  const result = await assertFastPathEquivalent({
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeFiles: compilationFiles(fixture.before, beforeResources),
    afterFiles: compilationFiles(fixture.after, afterResources),
    changedPaths,
    config: fixture.config,
  });
  assert.equal(
    result.components.find((component) => component.id === "action")?.state,
    "changed",
  );
});

async function relocatedFixture(t: TestContext) {
  const source = componentEntrySource({
    actionRender:
      '(props) => <button>{props.label}{props.label === "Continue" ? <img src="../../../image.svg" /> : null}</button>',
  });
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.mockupsDir, "components/nested"), {
    recursive: true,
  });
  for (const route of [
    "image.svg",
    "components/image.svg",
    "components/nested/image.svg",
  ])
    await fs.writeFile(path.join(fixture.mockupsDir, route), "image");
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(
    fixture.entryPath,
    source
      .replace(
        'route: "components/action.html"',
        'route: "components/nested/action.html"',
      )
      .replace('src="../../../image.svg"', 'src="../../../../image.svg"'),
  );
  const after = await compileCatalogue(config);
  return { before, after, config };
}

function actionViewPath(compilation: Compilation): string {
  const action = compilation.manifest.entries.find(
    (entry) => entry.kind === "component" && entry.id === "action",
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
        ? `${Buffer.from(value).toString("utf8")}<link rel="stylesheet" href="${path.posix.relative(path.posix.dirname(path.posix.join(".generated", route)), "main.css")}">`
        : value,
    ]),
  );
}
