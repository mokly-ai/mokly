import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

/** A packed consumer reads only public JSON and artifact files. */
export async function inspectPublicCatalogue(root, comparisonPath) {
  const json = await fs.readFile(
    path.join(root, "__mokly/catalogue.json"),
    "utf8",
  );
  const model = JSON.parse(json);
  assert.equal(model.schemaVersion, 1);
  assert.match(model.identity.id, /^[a-f0-9]{64}$/);
  assert.match(model.deploymentId, /^[a-f0-9]{64}$/);
  assert.equal(model.comparisonUrl, comparisonPath);
  assert.deepEqual(model.revision, { content: 0, evidence: 0 });
  assert.equal(model.changesStatus, comparisonPath ? "ready" : "disabled");
  for (const key of [
    "sourceFiles",
    "declaredDependencies",
    "ownedDependencies",
    "legacyPages",
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
    const paths =
      entry.kind === "page"
        ? [entry.documentPath]
        : entry.kind === "screen"
          ? entry.views.map((view) => view.fragmentPath)
          : entry.kind === "component"
            ? entry.variants.flatMap((variant) =>
                variant.views.map((view) => view.fragmentPath),
              )
            : [];
    for (const file of paths.filter(Boolean))
      assert.ok((await fs.stat(path.join(root, file))).isFile(), file);
  }
  return model;
}
