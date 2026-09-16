import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readPublicCatalogue } from "../src/server/public_catalogue_model.js";

test("shell requests reuse only an unchanged validated public revision", () => {
  let bytes = fs.readFileSync(
    "docs/protocol/fixtures/catalogue-v1.json",
    "utf8",
  );
  const source = { read: () => bytes };
  const first = readPublicCatalogue(source);
  assert.equal(readPublicCatalogue(source), first);
  const next = structuredClone(first);
  next.revision.evidence++;
  bytes = JSON.stringify(next);
  const updated = readPublicCatalogue(source);
  assert.notEqual(updated, first);
  assert.equal(updated.revision.evidence, first.revision.evidence + 1);
  bytes = JSON.stringify({ ...next, schemaVersion: 2 });
  assert.throws(() => readPublicCatalogue(source));
  bytes = JSON.stringify(next);
  assert.equal(readPublicCatalogue(source), updated);
});
