import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { committedReviewRepository } from "./helpers/committed_repository.js";
import {
  assertFastPathEquivalent,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

function actualOnlyPublicAssetSource(): string {
  return componentEntrySource({
    actionRender:
      '(props) => <button>{props.label}{props.label === "Finish" ? <img src="../../asset.svg" /> : null}</button>',
  });
}

test("committed non-CSS actual-invocation evidence belongs to its declared owner", async (t) => {
  const fixture = await changedFixture(
    t,
    actualOnlyPublicAssetSource(),
    { extraConfig: 'renderer: "renderer.tsx",' },
    async ({ root, mockupsDir }) => {
      await fs.writeFile(path.join(mockupsDir, "asset.svg"), "before-image");
      await fs.writeFile(path.join(root, "renderer.tsx"), resourceRenderer);
    },
  );
  await fs.writeFile(path.join(fixture.mockupsDir, "asset.svg"), "after-image");
  await fixture.build();
  const [live, artifact] = await Promise.all([
    computeCatalogueChanges(
      fixture.config,
      "main",
      committedReviewRepository(fixture.config),
    ),
    compareReview(
      await compileCatalogue(fixture.config),
      fixture.config,
      committedReviewRepository(fixture.config),
      "main",
    ),
  ]);
  assert.deepEqual(live.changedEntries, ["action"]);
  assert.equal(artifact.result.schemaVersion, 7);
  if (artifact.result.schemaVersion !== 7) return;
  assert.deepEqual(artifact.result.changes, [
    {
      kind: "component",
      before: artifact.result.components.find(
        (entry) => entry.path === "action",
      )!.before,
      after: artifact.result.components.find(
        (entry) => entry.path === "action",
      )!.after,
      reasons: [{ kind: "dependency", path: "mockups/asset.svg" }],
    },
  ]);
  assert.ok(
    artifact.result.affectedConsumers.some(
      (item) =>
        item.changedComponentId === "action" &&
        item.consumer.kind === "screen" &&
        item.consumer.path === "home",
    ),
  );
});

test("derived non-CSS actual-invocation bytes become owner material", async (t) => {
  const fixture = await createFixture(actualOnlyPublicAssetSource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), resourceRenderer);
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "asset.svg"),
    "current-image",
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const result = await assertFastPathEquivalent({
    before: compilation.manifest,
    after: compilation.manifest,
    beforeFiles: compilationFiles(compilation, {
      "asset.svg": "before-image",
    }),
    afterFiles: compilationFiles(compilation, {
      "asset.svg": "after-image",
    }),
    changedPaths: [],
    config: config,
  });
  assert.deepEqual(
    result.changes.map((entry) => ({
      route: entry.after?.path,
      reasons: entry.reasons,
    })),
    [{ route: "action", reasons: [{ kind: "material" }] }],
  );
  assert.ok(
    result.affectedConsumers.some(
      (item) =>
        item.changedComponentId === "action" && item.consumer.kind === "screen",
    ),
  );
});

test("non-public source-only edits supply no resource ownership", async (t) => {
  const source = componentEntrySource().replace(
    'path: "action",',
    'path: "action", dependencies: ["shared/action.ts"], ownedDependencies: ["shared/action.ts"],',
  );
  const fixture = await changedFixture(
    t,
    source,
    undefined,
    async ({ root }) => {
      await fs.mkdir(path.join(root, "shared"));
      await fs.writeFile(
        path.join(root, "shared/action.ts"),
        "export const value = 1;",
      );
    },
  );
  await fs.writeFile(
    path.join(fixture.root, "shared/action.ts"),
    "export const value = 2;",
  );
  const live = await computeCatalogueChanges(
    fixture.config,
    "main",
    committedReviewRepository(fixture.config),
  );
  assert.deepEqual(live.changedEntries, []);
  const result = live.componentChanges?.result;
  assert.equal(result?.schemaVersion, 7);
  assert.deepEqual(result?.changes, []);
});

const resourceRenderer = `import {renderToStaticMarkup} from "react-dom/server";
export default input => ({
  html: '<html><body>' + renderToStaticMarkup(input.node) + '</body></html>',
  resources: input.entry.path === "home" ? [{path: "asset.svg", componentIds: ["action"]}] : []
});`;
