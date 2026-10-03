import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { braceExpand, minimatch } from "minimatch";

import { evaluateDependencyAudit } from "../scripts/verification/dependency-audit-evaluation.mjs";

import { auditFixture } from "./helpers/dependency_audit.js";

test("catalogue globs retain ordinary brace alternatives and padded ranges", () => {
  assert.deepEqual(braceExpand("screens/{account,billing}/step-{01..03}.tsx"), [
    "screens/account/step-01.tsx",
    "screens/account/step-02.tsx",
    "screens/account/step-03.tsx",
    "screens/billing/step-01.tsx",
    "screens/billing/step-02.tsx",
    "screens/billing/step-03.tsx",
  ]);
  assert.equal(
    minimatch(
      "screens/billing/step-02.tsx",
      "screens/{account,billing}/**/*.tsx",
    ),
    true,
  );
});

test("glob expansion bounds total padded output, not just result count", () => {
  const first = `${"0".repeat(256)}1`;
  const expanded = braceExpand(`{${first}..100000}`);

  assert.equal(expanded[0], first);
  assert.ok(expanded.length > 1);
  assert.ok(
    expanded.reduce((length, value) => length + value.length, 0) <= 4_000_000,
    "padded sequences must respect the dependency's aggregate expansion budget",
  );
});

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
  assert.equal(result.ok, true, result.errors.join("\n"));
});
