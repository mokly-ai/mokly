import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  buildExportOwnership,
  parseExportOwnership,
  serializeExportOwnership,
} from "../dist/export/ownership.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";
import { ownershipMarkerFromFiles } from "./helpers/ownership_marker.js";

type OwnershipRejection = "unsupported-version" | "invalid";

interface OwnershipFixtures {
  schemaVersion: number;
  cases: Array<{
    name: string;
    document: unknown;
    valid: boolean;
    rejection?: OwnershipRejection;
  }>;
}

interface ReceiverReader {
  assertOwnershipMarker(value: unknown): Array<{
    path: string;
    sha256: string;
    size: number;
  }>;
  assertCompleteInventory(value: unknown, archiveFiles: string[]): void;
  verifyOwnershipFiles(value: unknown, directory: string): Promise<void>;
}

async function fixtures(): Promise<OwnershipFixtures> {
  return JSON.parse(
    await fs.readFile(
      path.join(
        repositoryRoot,
        "docs/protocol/fixtures/export-ownership-v2.json",
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
    const parsed = parseExportOwnership(JSON.stringify(sample.document));
    assert.equal(
      parsed.kind,
      sample.valid ? "valid" : sample.rejection,
      sample.name,
    );
  }
});

test("an independent receiver reader conforms to the public fixture cases", async () => {
  const cases = await fixtures();
  const reader = await receiverReader();
  for (const sample of cases.cases) {
    const read = () => reader.assertOwnershipMarker(sample.document);
    if (sample.valid) assert.doesNotThrow(read, sample.name);
    else
      assert.throws(
        read,
        (error: unknown) =>
          error instanceof Error &&
          "rejection" in error &&
          error.rejection === sample.rejection,
        sample.name,
      );
  }
});

test("receiver inventory checks reject missing, unlisted and duplicate archive members", async () => {
  const reader = await receiverReader();
  const marker = ownershipMarkerFromFiles(
    new Map([
      ["404.html", "Not found"],
      ["index.html", "Home"],
    ]),
  );
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

test("the ownership builder hashes exact bytes and sorts entry paths", () => {
  const files = new Map([
    ["mokly-upload.json", Buffer.from('{"schemaVersion":1}\n')],
    ["index.html", Buffer.from("Home 🌍\n")],
    ["404.html", Buffer.from([0, 1, 2, 255])],
  ]);
  assert.deepEqual(
    buildExportOwnership(files),
    ownershipMarkerFromFiles(files),
  );
});

test("the ownership builder has no upload file-count ceiling", () => {
  const fileCount = 20_001;
  const files = new Map<string, Buffer>();
  const empty = Buffer.alloc(0);
  for (let index = 0; index < fileCount; index++)
    files.set(`static/${String(index).padStart(5, "0")}.txt`, empty);
  const ownership = buildExportOwnership(files);
  assert.equal(ownership.files.length, fileCount);
  assert.equal(
    JSON.parse(serializeExportOwnership(ownership)).files.length,
    fileCount,
  );
});

test("the independent reader verifies extracted digest and size", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const output = path.join(fixture.root, "extracted");
  await fs.mkdir(output);
  const files = new Map([
    ["index.html", Buffer.from("Exact bytes\n")],
    ["static/empty.txt", Buffer.alloc(0)],
  ]);
  for (const [name, bytes] of files) {
    await fs.mkdir(path.dirname(path.join(output, name)), { recursive: true });
    await fs.writeFile(path.join(output, name), bytes);
  }
  const marker = ownershipMarkerFromFiles(files);
  const reader = await receiverReader();
  await reader.verifyOwnershipFiles(marker, output);
  await fs.writeFile(path.join(output, "index.html"), "Changed bytes\n");
  await assert.rejects(reader.verifyOwnershipFiles(marker, output));
});
