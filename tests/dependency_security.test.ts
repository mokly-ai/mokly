import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { evaluateDependencyAudit } from "../scripts/verification/dependency-audit-evaluation.mjs";

import { auditFixture, issueMessages } from "./helpers/dependency_audit.js";

test("reviewed exception data covers the captured report with the real lockfile", async () => {
  const root = new URL("../", import.meta.url);
  const [exceptions, lockfile, metadata] = await Promise.all([
    fs
      .readFile(
        new URL("scripts/verification/dependency-audit-exceptions.json", root),
        "utf8",
      )
      .then(JSON.parse),
    fs.readFile(new URL("package-lock.json", root), "utf8").then(JSON.parse),
    fs.readFile(new URL("package.json", root), "utf8").then(JSON.parse),
  ]);
  const { report, exception, today } = auditFixture();
  assert.equal(exceptions.length, 1);
  for (const field of ["advisory", "package", "path", "until"] as const)
    assert.deepEqual(exceptions[0][field], exception[field]);
  assert.equal(
    metadata.scripts["dependencies:check"],
    "node scripts/verification/dependency-audit.mjs",
  );
  const result = evaluateDependencyAudit(report, lockfile, exceptions, today);
  assert.equal(result.ok, true, issueMessages(result));
});
