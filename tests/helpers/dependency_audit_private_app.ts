import type {
  AuditException,
  AuditLockfile,
  AuditReport,
} from "../../scripts/verification/dependency-audit-evaluation.mjs";

/** A private app and a published package share one installed dependency tree. */
export function privateAppAuditFixture() {
  const exception: AuditException = {
    kind: "private-app",
    advisory: "GHSA-aaaa-bbbb-cccc",
    package: "vulnerable",
    path: ["packages/app", "node_modules/parent", "node_modules/vulnerable"],
    until: "2026-12-18",
    reason: "Private app tooling reads repository-authored patterns only.",
    tracking: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
  };
  const lockfile: AuditLockfile = {
    packages: {
      "": {},
      "packages/app": { dependencies: { parent: "*" } },
      "packages/viewer": {},
      "node_modules/parent": { dependencies: { vulnerable: "*" } },
      "node_modules/vulnerable": {},
    },
  };
  const report: AuditReport = {
    auditReportVersion: 2,
    vulnerabilities: {
      vulnerable: {
        name: "vulnerable",
        severity: "high",
        nodes: ["node_modules/vulnerable"],
        via: [
          {
            name: "vulnerable",
            dependency: "vulnerable",
            title: "Untrusted patterns exhaust resources",
            severity: "high",
            url: exception.tracking,
          },
        ],
      },
    },
  };
  const workspaces = {
    "packages/app": { private: true },
    "packages/viewer": {},
  };
  return {
    exception,
    lockfile,
    report,
    workspaces,
    today: new Date("2026-11-17T12:00:00Z"),
  };
}
