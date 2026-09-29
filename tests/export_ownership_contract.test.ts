import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parseExportOwnership } from "../dist/export/ownership.js";
import {
  assertCompleteInventory,
  checkOwnershipFixtures,
} from "../scripts/package/ownership.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

interface OwnershipFixtures {
  schemaVersion: number;
  cases: Array<{ name: string; document: unknown; valid: boolean }>;
}

async function fixtures(): Promise<OwnershipFixtures> {
  return JSON.parse(
    await fs.readFile(
      path.join(
        repositoryRoot,
        "docs/protocol/fixtures/export-ownership-v1.json",
      ),
      "utf8",
    ),
  ) as OwnershipFixtures;
}

test("the public ownership fixtures describe the exporter's accepted marker shapes", async () => {
  const cases = await fixtures();
  assert.equal(cases.schemaVersion, 1);
  assert.equal(
    new Set(cases.cases.map(({ name }) => name)).size,
    cases.cases.length,
  );
  assert.ok(cases.cases.some(({ valid }) => valid));
  assert.ok(cases.cases.some(({ valid }) => !valid));
  for (const sample of cases.cases) {
    if (
      !sample.document ||
      typeof sample.document !== "object" ||
      !("files" in sample.document) ||
      !Array.isArray(sample.document.files)
    )
      continue;
    for (const file of sample.document.files) {
      if (typeof file !== "string") continue;
      assert.equal(file.startsWith("id/"), false, sample.name);
      assert.equal(file.includes(".variants/"), false, sample.name);
    }
  }
  for (const sample of cases.cases)
    assert.equal(
      parseExportOwnership(JSON.stringify(sample.document)) !== undefined,
      sample.valid,
      sample.name,
    );
});

test("an independent receiver reader conforms to the public fixture cases", async () => {
  await checkOwnershipFixtures(repositoryRoot);
});

test("receiver inventory checks reject missing, unlisted and duplicate archive members", () => {
  const marker = { schemaVersion: 1, files: ["404.html", "index.html"] };
  const archive = ["index.html", ".mokly-export-artifact", "404.html"];
  assertCompleteInventory(marker, archive);
  for (const files of [
    archive.slice(1),
    [...archive, "unlisted.txt"],
    [...archive, "index.html"],
    archive.filter((file) => file !== ".mokly-export-artifact"),
  ])
    assert.throws(() => assertCompleteInventory(marker, files));
});
