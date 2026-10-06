import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { validateUploadManifest } from "../dist/publish/manifest.js";

import { FakeReceiverRejection } from "./helpers/fake_receiver_archive.js";
import { readFakeUploadManifest } from "./helpers/fake_receiver_documents.js";
import { repositoryRoot } from "./helpers/fixture.js";

interface ManifestCase {
  name: string;
  valid: boolean;
  document: unknown;
  rejection?: "invalid" | "unsupported-version";
}

async function fixture(): Promise<{
  schemaVersion: number;
  cases: ManifestCase[];
}> {
  return JSON.parse(
    await fs.readFile(
      path.join(
        repositoryRoot,
        "docs/protocol/fixtures/upload-manifest-v2.json",
      ),
      "utf8",
    ),
  ) as { schemaVersion: number; cases: ManifestCase[] };
}

test("the manifest fixture covers both states and every documented rejection", async () => {
  const contract = await fixture();
  assert.equal(contract.schemaVersion, 1);
  const valid = contract.cases.filter((sample) => sample.valid);
  assert.deepEqual(
    [
      ...new Set(
        valid.map(
          (sample) =>
            (sample.document as { uncommittedChanges: boolean })
              .uncommittedChanges,
        ),
      ),
    ].sort(),
    [false, true],
  );
  for (const name of [
    "schema-version-1",
    "missing-schema-version",
    "missing-uncommitted-changes",
    "string-uncommitted-changes",
    "extra-field",
  ])
    assert.ok(
      contract.cases.some((sample) => sample.name === name && !sample.valid),
      name,
    );
  assert.equal(
    contract.cases.find(({ name }) => name === "schema-version-1")?.rejection,
    "unsupported-version",
  );
});

test("the CLI manifest validator conforms to every public manifest case", async () => {
  for (const sample of (await fixture()).cases) {
    if (sample.valid) {
      assert.deepEqual(
        validateUploadManifest(sample.document),
        sample.document,
        sample.name,
      );
      continue;
    }
    assert.throws(
      () => validateUploadManifest(sample.document),
      {
        code:
          sample.rejection === "unsupported-version"
            ? "upload-unsupported-version"
            : "upload-invalid-bundle",
      },
      sample.name,
    );
  }
});

test("the test receiver classifies every public manifest case", async () => {
  for (const sample of (await fixture()).cases) {
    if (sample.valid) {
      assert.doesNotThrow(
        () => readFakeUploadManifest(sample.document),
        sample.name,
      );
      continue;
    }
    assert.throws(
      () => readFakeUploadManifest(sample.document),
      (error: unknown) =>
        error instanceof FakeReceiverRejection &&
        error.status ===
          (sample.rejection === "unsupported-version" ? 426 : 400),
      sample.name,
    );
  }
});

test("the independent package reader covers every manifest case", async () => {
  const reader = (await import(
    pathToFileURL(
      path.join(repositoryRoot, "scripts/package/upload_manifest.mjs"),
    ).href
  )) as { checkUploadManifestFixtures(root: string): Promise<void> };
  await reader.checkUploadManifestFixtures(repositoryRoot);
});
