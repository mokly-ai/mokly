import fs from "node:fs";

import type {
  AuditAdvisory,
  AuditReport,
  AuditException,
  AuditLockfile,
} from "../../scripts/verification/dependency-audit-evaluation.mjs";

const fixtureRoot = new URL("../fixtures/dependency-audit/", import.meta.url);

export function auditFixture() {
  const report: AuditReport = JSON.parse(
    fs.readFileSync(new URL("report.json", fixtureRoot), "utf8"),
  );
  const lockfile: AuditLockfile = JSON.parse(
    fs.readFileSync(new URL("lockfile.json", fixtureRoot), "utf8"),
  );
  const exception: AuditException = {
    advisory: "GHSA-vfj7-8cjw-p6xm",
    package: "braces",
    path: [
      "node_modules/metro-file-map",
      "node_modules/micromatch",
      "node_modules/braces",
    ],
    until: "2026-11-03",
    reason: "Dev-only Metro is not run by this repository.",
    tracking: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  };
  return {
    report,
    lockfile,
    exception,
    today: new Date("2026-10-03T12:00:00Z"),
  };
}

export function bracesAdvisory(report: AuditReport): AuditAdvisory {
  const advisory = report.vulnerabilities.braces!.via.find(
    (via): via is AuditAdvisory => typeof via !== "string",
  );
  assertAdvisory(advisory);
  return advisory;
}

function assertAdvisory(value: unknown): asserts value is AuditAdvisory {
  if (!value)
    throw new Error("fixture must contain the captured braces advisory");
}
