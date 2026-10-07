import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDependencyAudit } from "../scripts/verification/dependency-audit-evaluation.mjs";

import { auditFixture, bracesAdvisory } from "./helpers/dependency_audit.js";

test("uncovered findings retain their structured advisory fields", () => {
  const { report, lockfile, today } = auditFixture();
  const result = evaluateDependencyAudit(report, lockfile, [], today);
  const finding = result.issues.find((issue) => issue.kind === "finding");
  assert.ok(finding);
  const advisory = bracesAdvisory(report);
  assert.deepEqual(finding, {
    kind: "finding",
    message: finding.message,
    package: "braces",
    advisoryUrl: advisory.url,
    advisoryId: "GHSA-vfj7-8cjw-p6xm",
    severity: advisory.severity,
    title: advisory.title,
    installLocations: ["node_modules/braces"],
  });
  assert.match(finding.message, /Uncovered advisory/u);
});

test("non-array exception files and every invalid-clock message are input issues", () => {
  const { report, lockfile, exception, today } = auditFixture();
  for (const file of [null, {}, "", 1]) {
    const result = evaluateDependencyAudit(report, lockfile, file, today);
    assert.equal(
      result.issues.find((issue) =>
        /expected a JSON array/u.test(issue.message),
      )?.kind,
      "input",
    );
  }
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [exception],
    new Date("bad"),
  );
  const clocks = result.issues.filter((issue) => /clock/u.test(issue.message));
  assert.equal(clocks.length, 2);
  assert.ok(clocks.every((issue) => issue.kind === "input"));
});

test("invalid lockfile data and its failed path verification are input issues", () => {
  const { report, lockfile, exception, today } = auditFixture();
  for (const input of [null, {}, { packages: { "": {}, "/outside": {} } }]) {
    const result = evaluateDependencyAudit(report, input, [exception], today);
    const errors = result.issues.filter((issue) =>
      /lockfile|package-lock/u.test(issue.message),
    );
    assert.ok(errors.length > 0);
    assert.ok(errors.every((issue) => issue.kind === "input"));
  }
  lockfile.packages[""]!.dependencies = { "../unsafe": "*" };
  assert.ok(
    evaluateDependencyAudit(report, lockfile, [], today).issues.some(
      (issue) => issue.kind === "input",
    ),
  );
});

test("record schema, duplicate, expiry, review window and stale sources are exception issues", () => {
  const { report, lockfile, exception, today } = auditFixture();
  for (const [records, date, pattern] of [
    [[{ ...exception, reason: "" }], today, /Invalid exception/u],
    [[exception, exception], today, /duplicate/u],
    [[exception], new Date("2026-11-04"), /Expired/u],
    [[exception], new Date("2026-10-02"), /31 days/u],
    [[{ ...exception, advisory: "GHSA-aaaa-bbbb-cccc" }], today, /Stale/u],
  ] as const) {
    const result = evaluateDependencyAudit(report, lockfile, records, date);
    const issue = result.issues.find((entry) => pattern.test(entry.message));
    assert.equal(issue?.kind, "exception");
  }
});

test("registry errors and all invalid report shapes are report issues", () => {
  const { report, lockfile, exception, today } = auditFixture();
  for (const value of [
    null,
    {},
    { error: { code: "E503" } },
    { ...report, auditReportVersion: 1 },
  ]) {
    assert.ok(
      evaluateDependencyAudit(value, lockfile, [exception], today).issues.some(
        (issue) => issue.kind === "report",
      ),
    );
  }
  for (const field of ["via", "effects"] as const) {
    const changed = structuredClone(report);
    changed.vulnerabilities.metro![field]!.push("missing");
    assert.equal(
      evaluateDependencyAudit(
        changed,
        lockfile,
        [exception],
        today,
      ).issues.find((issue) => /missing/u.test(issue.message))?.kind,
      "report",
    );
  }
});
