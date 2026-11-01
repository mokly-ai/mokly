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

/**
 * A report with one advisory for each reviewed exception, at the last
 * element of its path, and a time on the earliest end date. A test then
 * checks committed records against a lockfile without a live audit, which
 * alone checks the expiry and the review window.
 */
export function exceptionAuditInput(exceptions: readonly AuditException[]) {
  const vulnerabilities: AuditReport["vulnerabilities"] = {};
  for (const { advisory, package: name, path } of exceptions) {
    const entry = (vulnerabilities[name] ??= {
      name,
      severity: "moderate",
      via: [],
      nodes: [],
    });
    entry.via.push({
      name,
      dependency: name,
      title: `Reviewed advisory ${advisory}`,
      url: `https://github.com/advisories/${advisory}`,
      severity: "moderate",
    });
    const node = path.at(-1);
    if (node !== undefined && !entry.nodes.includes(node))
      entry.nodes.push(node);
  }
  const report: AuditReport = { auditReportVersion: 2, vulnerabilities };
  const [earliest = "2026-11-01"] = exceptions.map(({ until }) => until).sort();
  return { report, today: new Date(`${earliest}T12:00:00Z`) };
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

/** Render issue messages without discarding their structured kinds. */
export function issueMessages(result: {
  issues: readonly { message: string }[];
}): string {
  return result.issues.map((issue) => issue.message).join("\n");
}
