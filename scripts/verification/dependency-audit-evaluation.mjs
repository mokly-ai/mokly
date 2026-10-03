import {
  isHttpsUrl,
  validateAuditExceptions,
} from "./dependency-audit-exceptions.mjs";
import {
  exceptionPathErrors,
  isInstallLocation,
  isPackageName,
  isRecord,
  lockfileErrors,
} from "./dependency-audit-lockfile.mjs";

const SEVERITIES = ["info", "low", "moderate", "high", "critical"];

function inspectReport(report) {
  if (isRecord(report) && Object.hasOwn(report, "error"))
    return {
      errors: [
        `npm registry or transport error: ${JSON.stringify(report.error)}. Restore registry access and retry; no exception applies.`,
      ],
      findings: [],
    };
  if (
    !isRecord(report) ||
    report.auditReportVersion !== 2 ||
    !isRecord(report.vulnerabilities)
  )
    return {
      errors: [
        "Invalid npm audit report: expected auditReportVersion 2 and vulnerabilities object. Check npm and registry output, then retry.",
      ],
      findings: [],
    };
  const errors = [];
  const findings = [];
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    if (
      !isPackageName(name) ||
      !isRecord(entry) ||
      entry.name !== name ||
      !SEVERITIES.includes(entry.severity) ||
      !Array.isArray(entry.nodes) ||
      entry.nodes.length === 0 ||
      !entry.nodes.every(isInstallLocation) ||
      !Array.isArray(entry.via) ||
      entry.via.length === 0
    ) {
      errors.push(
        `Invalid npm audit entry ${name}. Check npm's report shape and retry.`,
      );
      continue;
    }
    for (const via of entry.via) {
      if (typeof via === "string") {
        if (!Object.hasOwn(report.vulnerabilities, via))
          errors.push(
            `Invalid npm audit reference ${name} via ${via}: entry is missing. Check npm and registry output, then retry.`,
          );
      } else if (
        !isRecord(via) ||
        via.name !== name ||
        via.dependency !== name ||
        typeof via.title !== "string" ||
        via.title.trim() === "" ||
        !isHttpsUrl(via.url) ||
        !SEVERITIES.includes(via.severity)
      ) {
        errors.push(
          `Invalid npm audit advisory in ${name}. Check npm's report shape and retry.`,
        );
      } else findings.push({ name, advisory: via, nodes: entry.nodes });
    }
    if (entry.effects !== undefined) {
      if (!Array.isArray(entry.effects))
        errors.push(
          `Invalid npm audit effects in ${name}. Check npm's report shape and retry.`,
        );
      else
        for (const effect of entry.effects)
          if (
            typeof effect !== "string" ||
            !Object.hasOwn(report.vulnerabilities, effect)
          )
            errors.push(
              `Invalid npm audit effect ${name} -> ${effect}: entry is missing. Check npm and registry output, then retry.`,
            );
    }
  }
  if (Object.keys(report.vulnerabilities).length && findings.length === 0)
    errors.push(
      "Invalid npm audit report: effect entries have no advisory objects. Check npm and registry output, then retry.",
    );
  return { errors, findings };
}

function advisoryId(url) {
  const parsed = new URL(url);
  return parsed.hostname === "github.com"
    ? parsed.pathname.match(
        /^\/advisories\/(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})$/u,
      )?.[1]
    : undefined;
}

function uncoveredNotice(name, advisory, nodes) {
  return [
    `Uncovered advisory ${advisoryId(advisory.url) ?? "(no GHSA identifier)"}; package: ${name}; severity: ${advisory.severity}.`,
    `Title: ${advisory.title}`,
    `URL: ${advisory.url}`,
    `Install locations: ${nodes.join(", ")}`,
    "Action: Update the dependency to remove the advisory, or request a reviewed exception for this exact dev-only path.",
  ].join("\n");
}

function acceptedNotice(record) {
  const { exception, daysLeft } = record;
  return [
    `Accepted dependency risk: ${exception.advisory}; package: ${exception.package}.`,
    `Path: ${exception.path.join(" -> ")}`,
    `End date: ${exception.until} UTC; ${daysLeft} days left.`,
    `Reason: ${exception.reason}`,
    `Tracking: ${exception.tracking}`,
  ].join("\n");
}

/** Evaluate untrusted audit and file data without IO or ambient time. */
export function evaluateDependencyAudit(report, lockfile, exceptions, now) {
  const reviewed = validateAuditExceptions(exceptions, now);
  const inspected = inspectReport(report);
  const reportIssues = inspected.errors;
  const lockfileIssues = lockfileErrors(lockfile);
  const errors = [...reviewed.errors, ...reportIssues, ...lockfileIssues];
  const notices = [];
  for (const { name, advisory, nodes } of inspected.findings) {
    if (advisory.severity === "info") continue;
    let covered = false;
    for (const record of reviewed.records) {
      if (
        record.exception.advisory !== advisoryId(advisory.url) ||
        record.exception.package !== name
      )
        continue;
      record.matched = true;
      if (reportIssues.length) continue;
      const pathIssues =
        lockfileIssues.length === 0
          ? exceptionPathErrors(record.exception, nodes, lockfile.packages)
          : ["the lockfile is invalid, so the path cannot be verified"];
      if (pathIssues.length) {
        const issue = `Invalid ${record.label}: ${pathIssues.join("; ")}. Review the changed path or remove the exception and update dependencies.`;
        if (!record.errors.includes(issue)) record.errors.push(issue);
      }
      if (record.errors.length === 0) {
        covered = true;
        if (!record.used) notices.push(acceptedNotice(record));
        record.used = true;
      }
    }
    if (!covered) errors.push(uncoveredNotice(name, advisory, nodes));
  }
  if (reportIssues.length === 0) {
    for (const record of reviewed.records)
      if (!record.matched)
        record.errors.push(
          `Stale ${record.label}: no current finding matches this record. Remove the exception; do not keep an unused risk acceptance.`,
        );
  }
  for (const record of reviewed.records) errors.push(...record.errors);
  return { ok: errors.length === 0, errors, notices };
}
