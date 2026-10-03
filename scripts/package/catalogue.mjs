import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { entryRoute, viewRoute } from "@mokly/viewer/data";

/** A packed consumer reads only public JSON and artifact files. */
export async function inspectPublicCatalogue(root, comparisonPath) {
  const json = await fs.readFile(
    path.join(root, "__mokly/catalogue.json"),
    "utf8",
  );
  const model = JSON.parse(json);
  assert.equal(model.schemaVersion, 4);
  assert.match(model.identity.id, /^[a-f0-9]{64}$/);
  assert.match(model.deploymentId, /^[a-f0-9]{64}$/);
  assert.equal(model.comparisonUrl, comparisonPath);
  assert.deepEqual(model.revision, { content: 0, evidence: 0 });
  assert.equal(model.changesStatus, comparisonPath ? "ready" : "disabled");
  for (const key of [
    "sourceFiles",
    "declaredDependencies",
    "ownedDependencies",
    "route",
    "documentPath",
    "fragmentPath",
    "startOffset",
    "endOffset",
  ])
    assert.equal(json.includes(`"${key}":`), false, key);
  const entries = [
    ...model.screens,
    ...model.pages,
    ...model.useCases,
    ...model.components,
  ];
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    const shell = path.join(root, "view", entryRoute(entry.path));
    assert.ok((await fs.stat(shell)).isFile(), shell);
    const views = "views" in entry ? entry.views : [];
    for (const view of views) {
      const file = path.join(
        root,
        "static",
        viewRoute(entry.path, view.viewport, view.colorScheme),
      );
      assert.ok((await fs.stat(file)).isFile(), file);
    }
  }
  return model;
}
