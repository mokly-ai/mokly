import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import {
  assertFastPathEquivalent,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

function actualOnlyPublicAssetSource(): string {
  return componentEntrySource({
    actionRender:
      '(props) => <button>{props.label}{props.label === "Finish" ? <img src="../asset.svg" /> : null}</button>',
  }).replace(
    'id: "action",',
    'id: "action", dependencies: ["mockups/asset.svg"], ownedDependencies: ["mockups/asset.svg"],',
  );
}

test("committed non-CSS actual-invocation evidence belongs to its declared owner", async (t) => {
  const fixture = await changedFixture(
    t,
    actualOnlyPublicAssetSource(),
    undefined,
    ({ mockupsDir }) =>
      fs.writeFile(path.join(mockupsDir, "asset.svg"), "before-image"),
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
  assert.deepEqual(live.changedIds, ["action"]);
  assert.equal(artifact.result.schemaVersion, 4);
  if (artifact.result.schemaVersion !== 4) return;
  assert.deepEqual(artifact.result.changes, [
    {
      kind: "component",
      before: artifact.result.components.find((entry) => entry.id === "action")!
        .before,
      after: artifact.result.components.find((entry) => entry.id === "action")!
        .after,
      reasons: [{ kind: "dependency", path: "mockups/asset.svg" }],
    },
  ]);
  assert.ok(
    artifact.result.affectedConsumers.some(
      (item) =>
        item.changedComponentId === "action" &&
        item.consumer.kind === "screen" &&
        item.consumer.id === "home",
    ),
  );
});

test("derived non-CSS actual-invocation bytes become owner material", async (t) => {
  const fixture = await createFixture(actualOnlyPublicAssetSource());
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
    config: { ...config, generatedOutput: "derived" },
  });
  assert.deepEqual(
    result.changes.map((entry) => ({
      route: entry.after?.id,
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

test("non-public implementation dependencies keep declarative ownership", async (t) => {
  const source = componentEntrySource().replace(
    'id: "action",',
    'id: "action", dependencies: ["shared/action.ts"], ownedDependencies: ["shared/action.ts"],',
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
  assert.deepEqual(live.changedIds, ["action"]);
  const result = live.componentChanges?.result;
  assert.equal(result?.schemaVersion, 4);
  if (result?.schemaVersion !== 4) return;
  assert.deepEqual(result.changes[0]?.reasons, [
    { kind: "dependency", path: "shared/action.ts" },
  ]);
});
