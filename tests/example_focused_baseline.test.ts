import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parseManifest } from "../dist/registry/manifest.js";
import type { ManifestV8 } from "../packages/viewer/dist/registry/types.js";

import { designCatalogue } from "./helpers/design_catalogue.js";
import { createCommittedExampleBaseline } from "./helpers/example_baseline.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("ordinary preview fixture discovers every example component and variant", async (t) => {
  await fs.mkdir(path.join(repositoryRoot, ".context"), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/example-focused-baseline-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { manifest } = await designCatalogue;
  const config = await createCommittedExampleBaseline(root, "ordinary-preview");
  const focused = parseManifest(
    JSON.parse(
      await fs.readFile(
        path.join(config.mockupsDir, "mokly-manifest.json"),
        "utf8",
      ),
    ),
  );
  const required = exampleComponents(manifest);
  assert.ok(required.length > 0);
  assert.deepEqual(exampleComponents(focused), required);
});

function exampleComponents(manifest: ManifestV8) {
  return manifest.entries
    .filter(
      (entry) =>
        entry.kind === "component" &&
        entry.path.startsWith("example/components/"),
    )
    .map((entry) => ({ path: entry.path, sourcePath: entry.sourcePath }))
    .sort((left, right) => left.path.localeCompare(right.path));
}
