import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { parseExportOwnership } from "../dist/export/ownership.js";

import { repositoryRoot } from "./helpers/fixture.js";

interface OwnershipFixtures {
  schemaVersion: number;
  cases: Array<{ name: string; document: unknown; valid: boolean }>;
}

interface ReceiverReader {
  assertOwnershipMarker(value: unknown): string[];
  assertCompleteInventory(value: unknown, archiveFiles: string[]): void;
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

async function receiverReader(): Promise<ReceiverReader> {
  return (await import(
    pathToFileURL(path.join(repositoryRoot, "scripts/package/ownership.mjs"))
      .href
  )) as ReceiverReader;
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
  const cases = await fixtures();
  const reader = await receiverReader();
  for (const sample of cases.cases) {
    const read = () => reader.assertOwnershipMarker(sample.document);
    if (sample.valid) assert.doesNotThrow(read, sample.name);
    else assert.throws(read, sample.name);
  }
});

test("receiver inventory checks reject missing, unlisted and duplicate archive members", async () => {
  const reader = await receiverReader();
  const marker = { schemaVersion: 1, files: ["404.html", "index.html"] };
  const archive = ["index.html", ".mokly-export-artifact", "404.html"];
  reader.assertCompleteInventory(marker, archive);
  for (const files of [
    archive.slice(1),
    [...archive, "unlisted.txt"],
    [...archive, "index.html"],
    archive.filter((file) => file !== ".mokly-export-artifact"),
  ])
    assert.throws(() => reader.assertCompleteInventory(marker, files));
});
