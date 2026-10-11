import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDependencyAudit } from "../scripts/verification/dependency-audit-evaluation.mjs";

import {
  auditFixture,
  bracesAdvisory,
  issueMessages,
} from "./helpers/dependency_audit.js";

test("exception schema rejects unknown, missing, empty, and mistyped fields", () => {
  const { report, lockfile, exception, today } = auditFixture();
  const invalid: unknown[] = [null, {}, { ...exception, extra: true }];
  for (const key of Object.keys(exception)) {
    const missing = { ...exception } as Record<string, unknown>;
    delete missing[key];
    invalid.push(
      missing,
      { ...exception, [key]: "" },
      { ...exception, [key]: null },
    );
  }
  for (const value of invalid) {
    const result = evaluateDependencyAudit(report, lockfile, [value], today);
    assert.equal(result.ok, false, JSON.stringify(value));
    assert.match(issueMessages(result), /Invalid exception/u);
  }
  for (const file of [null, {}, { exceptions: [exception] }, "", 1])
    assert.equal(
      evaluateDependencyAudit(report, lockfile, file, today).ok,
      false,
    );
});

test("exception schema validates dates, identifiers, tracking URLs, and paths", () => {
  const { report, lockfile, exception, today } = auditFixture();
  for (const until of [
    "2026-2-03",
    "2026-02-30",
    "2026-13-03",
    "2026-11-03T00:00:00Z",
    "not-a-date",
  ])
    assert.equal(
      evaluateDependencyAudit(
        report,
        lockfile,
        [{ ...exception, until }],
        today,
      ).ok,
      false,
      until,
    );
  for (const patch of [
    { advisory: "CVE-2026-93687" },
    { package: "../braces" },
    { package: " braces " },
    { tracking: "not-a-url" },
    { tracking: "javascript:alert(1)" },
    { reason: "   " },
    { path: [] },
    { path: "node_modules/braces" },
    { path: ["node_modules/braces"] },
    { path: ["/node_modules/metro-file-map", "node_modules/braces"] },
    { path: ["node_modules/../braces", "node_modules/braces"] },
    { path: ["node_modules\\metro-file-map", "node_modules/braces"] },
    { path: ["node_modules/metro-file-map/", "node_modules/braces"] },
    { path: ["node_modules/metro-file-map", "node_modules/micromatch"] },
    { path: ["node_modules/braces", "node_modules/braces"] },
  ]) {
    const result = evaluateDependencyAudit(
      report,
      lockfile,
      [{ ...exception, ...patch }],
      today,
    );
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.match(issueMessages(result), /Invalid exception/u);
  }
});

test("duplicate exceptions fail even when review text differs", () => {
  const { report, lockfile, exception, today } = auditFixture();
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [exception, { ...exception, reason: "Different text" }],
    today,
  );
  assert.equal(result.ok, false);
  assert.match(issueMessages(result), /duplicate/iu);
});

test("all invalid exceptions are reported with actions", () => {
  const { report, lockfile, exception, today } = auditFixture();
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [
      { ...exception, until: "2026-10-02" },
      { ...exception, advisory: "GHSA-aaaa-bbbb-cccc" },
      { ...exception, package: "" },
    ],
    today,
  );
  for (const value of [
    "expired",
    "stale",
    "Invalid exception",
    "Remove",
    "review",
  ])
    assert.ok(
      issueMessages(result).toLowerCase().includes(value.toLowerCase()),
      value,
    );
});

test("audit error JSON and unexpected report shapes fail closed", () => {
  const { report, lockfile, exception, today } = auditFixture();
  for (const invalid of [
    null,
    [],
    {},
    { error: { code: "ECONNRESET", summary: "registry failed" } },
    { ...report, error: {} },
    { ...report, auditReportVersion: 1 },
    { auditReportVersion: 2 },
    { auditReportVersion: 2, vulnerabilities: [] },
  ])
    assert.equal(
      evaluateDependencyAudit(invalid, lockfile, [exception], today).ok,
      false,
    );
});

test("dangling via and effects references fail even with a covered advisory", () => {
  for (const field of ["via", "effects"] as const) {
    const { report, lockfile, exception, today } = auditFixture();
    report.vulnerabilities.metro![field]!.push("missing-package");
    const result = evaluateDependencyAudit(
      report,
      lockfile,
      [exception],
      today,
    );
    assert.equal(result.ok, false);
    assert.match(issueMessages(result), /missing-package/u);
  }
});

test("malformed vulnerability entries and advisory objects fail", () => {
  const { report, lockfile, exception, today } = auditFixture();
  for (const entry of [
    null,
    {},
    { ...report.vulnerabilities.braces, severity: "unknown" },
    { ...report.vulnerabilities.braces, name: "other" },
    { ...report.vulnerabilities.braces, via: [] },
    { ...report.vulnerabilities.braces, via: [null] },
    { ...report.vulnerabilities.braces, nodes: [] },
    {
      ...report.vulnerabilities.braces,
      via: [{ ...bracesAdvisory(report), dependency: "missing" }],
    },
  ]) {
    const invalid = {
      ...report,
      vulnerabilities: { ...report.vulnerabilities, braces: entry },
    };
    assert.equal(
      evaluateDependencyAudit(invalid, lockfile, [exception], today).ok,
      false,
    );
  }
});

test("invalid lockfiles and clocks fail closed", () => {
  const { report, lockfile, exception, today } = auditFixture();
  for (const invalid of [
    null,
    {},
    { packages: [] },
    { ...lockfile, packages: { ...lockfile.packages, "": null } },
    {
      ...lockfile,
      packages: {
        ...lockfile.packages,
        "packages/viewer": { peerDependencies: [] },
      },
    },
  ])
    assert.equal(
      evaluateDependencyAudit(report, invalid, [exception], today).ok,
      false,
    );
  assert.equal(
    evaluateDependencyAudit(report, lockfile, [exception], new Date("bad")).ok,
    false,
  );
});

test("lockfile locations must be normalized and relative", () => {
  for (const location of [
    "/outside",
    "node_modules/../other",
    "node_modules//other",
    "node_modules\\other",
  ]) {
    const { report, lockfile, exception, today } = auditFixture();
    lockfile.packages[location] = {};
    assert.equal(
      evaluateDependencyAudit(report, lockfile, [exception], today).ok,
      false,
      location,
    );
  }
});

test("invalid records do not hide uncovered advisories", () => {
  const { report, lockfile, exception, today } = auditFixture();
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [{ ...exception, reason: "" }],
    today,
  );
  assert.match(issueMessages(result), /Invalid exception/u);
  assert.match(
    issueMessages(result),
    /Uncovered advisory GHSA-vfj7-8cjw-p6xm/u,
  );
});

test("effect cycles without any advisory object fail closed", () => {
  const { report, lockfile, exception, today } = auditFixture();
  report.vulnerabilities.braces!.via = ["micromatch"];
  const result = evaluateDependencyAudit(report, lockfile, [exception], today);
  assert.equal(result.ok, false);
  assert.match(issueMessages(result), /no advisory objects/u);
});
