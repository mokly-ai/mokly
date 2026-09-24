import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { projectCatalogue } from "../dist/catalogue/projection.js";
import { compareReview } from "../dist/review/compare.js";
import { readCatalogue } from "../packages/viewer/dist/catalogue/reader.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { cssSchemaFixture } from "./helpers/review_css_schema.js";

test("catalogue v2 omits dependencies and rejects v1", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const model = projectCatalogue({
    configPath: "mokly.config.ts",
    catalogue: createCatalogue(fixture.after.manifest),
    changesStatus: "disabled",
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  });
  assert.equal(model.schemaVersion, 2);
  for (const entry of [
    ...model.collections,
    ...model.screens,
    ...model.pages,
    ...model.useCases,
    ...model.components,
    ...model.removedEntries.map(({ entry }) => entry),
  ])
    assert.equal(Object.hasOwn(entry.details, "dependencies"), false);
  assert.deepEqual(readCatalogue(JSON.parse(JSON.stringify(model))), model);
  const publicFixture = JSON.parse(
    await fs.readFile("docs/protocol/fixtures/catalogue-v2.json", "utf8"),
  );
  assert.deepEqual(readCatalogue(publicFixture), publicFixture);
  for (const entry of [
    ...publicFixture.collections,
    ...publicFixture.screens,
    ...publicFixture.pages,
    ...publicFixture.useCases,
    ...publicFixture.components,
    ...publicFixture.removedEntries.map(
      ({ entry }: { entry: { details: object } }) => entry,
    ),
  ])
    assert.equal(Object.hasOwn(entry.details, "dependencies"), false);
  const old = { ...publicFixture, schemaVersion: 1 };
  assert.throws(() => readCatalogue(old), /unsupported schemaVersion/);
  const legacyField = structuredClone(model) as unknown as {
    screens: { details: Record<string, unknown> }[];
  };
  legacyField.screens[0]!.details.dependencies = [];
  assert.throws(
    () => readCatalogue(legacyField),
    /private|dependencies|unexpected/i,
  );
});

test("comparison v4 and v5 omit legacy evidence and reject v2/v3", async (t) => {
  for (const oldVersion of [2, 3] as const) {
    const legacy = {
      ...cssSchemaFixture(oldVersion === 2 ? 4 : 5),
      schemaVersion: oldVersion,
    };
    assert.throws(
      () => parseReviewResult(legacy),
      /unsupported result version/,
    );
  }
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace(
      "<button data-viewport=",
      '<button className="changed" data-viewport=',
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  assert.equal(Object.hasOwn(result, "sharedImpact"), false);
  for (const entry of [
    ...result.screens,
    ...("components" in result ? result.components : []),
  ]) {
    assert.equal(Object.hasOwn(entry, "dependencies"), false);
    assert.equal(Object.hasOwn(entry, "sharedImpact"), false);
  }
  assert.deepEqual(
    parseReviewResult(JSON.parse(JSON.stringify(result))),
    result,
  );
  const screenOnly = cssSchemaFixture(4);
  assert.deepEqual(parseReviewResult(screenOnly), screenOnly);
  for (const current of [screenOnly, result]) {
    for (const field of ["sharedImpact", "dependencies"] as const) {
      const withResultField = JSON.parse(JSON.stringify(current));
      withResultField[field] = [];
      assert.throws(() => parseReviewResult(withResultField), /review/i);
      const withEntryField = JSON.parse(JSON.stringify(current));
      withEntryField.screens[0][field] = [];
      assert.throws(() => parseReviewResult(withEntryField), /review/i);
    }
    if (current.schemaVersion === 5 && current.components.length) {
      const withComponentField = JSON.parse(JSON.stringify(current));
      withComponentField.components[0].dependencies = [];
      assert.throws(() => parseReviewResult(withComponentField), /review/i);
    }
  }
});
