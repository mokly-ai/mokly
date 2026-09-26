import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { FakeReceiverRejection } from "./helpers/fake_receiver_archive.js";
import { readFakeOwnership } from "./helpers/fake_receiver_documents.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("fake receiver independently matches every public ownership fixture case", async () => {
  const fixture = JSON.parse(
    await fs.readFile(
      path.join(
        repositoryRoot,
        "docs/protocol/fixtures/export-ownership-v2.json",
      ),
      "utf8",
    ),
  ) as {
    cases: Array<{
      document: unknown;
      name: string;
      rejection?: "invalid" | "unsupported-version";
      valid: boolean;
    }>;
  };
  for (const sample of fixture.cases) {
    if (sample.valid) {
      assert.doesNotThrow(
        () => readFakeOwnership(sample.document),
        sample.name,
      );
      continue;
    }
    assert.throws(
      () => readFakeOwnership(sample.document),
      (error: unknown) =>
        error instanceof FakeReceiverRejection &&
        error.status ===
          (sample.rejection === "unsupported-version" ? 426 : 400),
      sample.name,
    );
  }
});
