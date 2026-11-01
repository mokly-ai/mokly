import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { evaluateDependencyAudit } from "../scripts/verification/dependency-audit-evaluation.mjs";

import {
  exceptionAuditInput,
  issueMessages,
} from "./helpers/dependency_audit.js";

test("the committed exceptions are valid with the real lockfile", async () => {
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
  assert.equal(
    metadata.scripts["dependencies:check"],
    "node scripts/verification/dependency-audit.mjs",
  );
  const { report, today } = exceptionAuditInput(exceptions);
  const result = evaluateDependencyAudit(report, lockfile, exceptions, today);
  assert.equal(result.ok, true, issueMessages(result));
});
