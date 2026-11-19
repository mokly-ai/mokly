// Evaluated as an ESM entry from the repository root so the public package resolves normally.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { readCatalogueIndex } from "@mokly/viewer";

const [corpusPath, ...producerIndexes] = process.argv.slice(1);
const { caseDocument } = await import(
  new URL("index-corpus.mjs", pathToFileURL(corpusPath))
);
const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
assert.equal(corpus.schemaVersion, 1);
for (const [name, field] of [
  ["mokly", "moklyVersion"],
  ["viewer", "viewerVersion"],
]) {
  const installed = JSON.parse(
    await readFile(
      join(process.cwd(), `node_modules/@mokly/${name}/package.json`),
      "utf8",
    ),
  );
  assert.equal(
    corpus[field],
    installed.version,
    `Update the corpus for @mokly/${name}@${installed.version}`,
  );
}

/** @param {import('@mokly/viewer').CatalogueReadModel} index */
function changesCounts(index) {
  const counts = { changed: 0, added: 0, removed: 0, moved: 0 };
  const current = [
    ...index.screens,
    ...index.pages,
    ...index.documents,
    ...index.useCases,
    ...index.components,
  ];
  for (const [entries, historical] of [
    [current, false],
    [index.removedEntries.map(({ entry }) => entry), true],
  ]) {
    for (const entry of entries) {
      if (entry.changes.status !== "ready" || !entry.changes.included) continue;
      switch (entry.changes.kind) {
        case "added":
          counts.added += 1;
          break;
        case "removed":
          counts.removed += 1;
          break;
        case "unmodified":
        case "changed":
          counts.changed += 1;
          break;
      }
      if (!historical && entry.previousPath !== undefined) counts.moved += 1;
    }
  }
  return counts;
}

const names = new Set();
for (const test of corpus.cases) {
  assert(!names.has(test.name), `Repeated corpus case: ${test.name}`);
  names.add(test.name);
  const accepted = test.counts !== undefined;
  assert.equal(test.cloudRejection === undefined, accepted, test.name);
  if (!accepted)
    assert(
      ["invalid", "unsupported-version"].includes(test.cloudRejection),
      test.name,
    );
  const bytes = caseDocument(corpus.baseDocument, test);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    test.documentSha256,
    `Corpus input bytes differ: ${test.name}`,
  );
  let index;
  try {
    index = readCatalogueIndex(JSON.parse(bytes));
  } catch (error) {
    if (accepted)
      throw new Error(`Viewer refused cloud-accepted case: ${test.name}`, {
        cause: error,
      });
  }
  if (accepted) {
    assert.deepEqual(
      changesCounts(index),
      test.counts,
      `Viewer counts differ: ${test.name}`,
    );
  } else {
    assert.equal(typeof test.viewerValid, "boolean", test.name);
    assert.equal(
      index !== undefined,
      test.viewerValid,
      `Viewer verdict differs: ${test.name}`,
    );
  }
}
for (const path of producerIndexes) {
  const index = readCatalogueIndex(JSON.parse(await readFile(path, "utf8")));
  console.log(`Viewer index: ${path}: ${JSON.stringify(changesCounts(index))}`);
}
console.log(
  `Viewer index corpus matches (${names.size} cases, ${producerIndexes.length} producer indexes).`,
);
