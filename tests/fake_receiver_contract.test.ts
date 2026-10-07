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
        "docs/protocol/fixtures/export-ownership-v3.json",
      ),
      "utf8",
    ),
  ) as {
    cases: Array<{
      document: unknown;
      name: string;
      rejection?: "invalid" | "too-large" | "unsupported-version";
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
          (sample.rejection === "unsupported-version"
            ? 426
            : sample.rejection === "too-large"
              ? 413
              : 400),
      sample.name,
    );
  }
});

test("ownership rejection classes use the exchange contract statuses", async () => {
  const fixture = JSON.parse(
    await fs.readFile(
      path.join(
        repositoryRoot,
        "docs/protocol/fixtures/export-ownership-v3.json",
      ),
      "utf8",
    ),
  ) as {
    cases: Array<{
      document: unknown;
      rejection?: "invalid" | "too-large" | "unsupported-version";
      valid: boolean;
    }>;
  };
  const exchange = await fs.readFile(
    path.join(repositoryRoot, "docs/protocol/mokly-upload-validation.md"),
    "utf8",
  );
  const documented = new Map([
    [
      "unsupported-version",
      rowStatuses(exchange, /ownership `schemaVersion`/u),
    ],
    ["invalid", rowStatuses(exchange, /Invalid archive/u)],
    ["too-large", rowStatuses(exchange, /Any exceeded limit/u)],
  ]);
  assert.deepEqual([...documented.keys()].sort(), [
    "invalid",
    "too-large",
    "unsupported-version",
  ]);
  for (const sample of fixture.cases.filter(({ valid }) => !valid)) {
    assert.ok(sample.rejection);
    const statuses = documented.get(sample.rejection);
    assert.ok(statuses?.length, sample.rejection);
    assert.throws(
      () => readFakeOwnership(sample.document),
      (error: unknown) =>
        error instanceof FakeReceiverRejection &&
        statuses.includes(error.status),
      sample.rejection,
    );
  }
});

function rowStatuses(source: string, label: RegExp): number[] {
  const row = source
    .split("\n")
    .find((line) => line.startsWith("|") && label.test(line));
  assert.ok(row, String(label));
  return [...row.matchAll(/\b(?:400|413|422|426)\b/gu)].map(([status]) =>
    Number(status),
  );
}
