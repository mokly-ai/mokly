import {
  isInstallLocation,
  isPackageName,
  isRecord,
} from "./dependency-audit-lockfile.mjs";

const REQUIRED_KEYS = [
  "advisory",
  "package",
  "path",
  "until",
  "reason",
  "tracking",
];
const DAY_MS = 86_400_000;

/** Recognize an absolute HTTPS URL without embedded credentials. */
export function isHttpsUrl(value) {
  if (typeof value !== "string" || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.username === "" && url.password === ""
    );
  } catch {
    return false;
  }
}

function calendarDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return undefined;
  const epoch = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(epoch) &&
    new Date(epoch).toISOString().slice(0, 10) === value
    ? epoch
    : undefined;
}

function schemaErrors(record) {
  if (!isRecord(record)) return ["record must be an object"];
  const errors = [];
  if (
    Object.keys(record).some((key) => !REQUIRED_KEYS.includes(key)) ||
    REQUIRED_KEYS.some((key) => !Object.hasOwn(record, key))
  )
    errors.push(
      "use exactly advisory, package, path, until, reason, and tracking",
    );
  if (
    typeof record.advisory !== "string" ||
    record.advisory.trim() !== record.advisory ||
    !/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/u.test(record.advisory)
  )
    errors.push("advisory must be a GHSA identifier");
  if (!isPackageName(record.package))
    errors.push("package must be an npm package name");
  if (typeof record.reason !== "string" || record.reason.trim() === "")
    errors.push("reason must be non-empty text");
  if (!isHttpsUrl(record.tracking))
    errors.push("tracking must be an absolute HTTPS URL");
  if (calendarDay(record.until) === undefined)
    errors.push("until must be a valid YYYY-MM-DD date");
  if (
    !Array.isArray(record.path) ||
    record.path.length < 2 ||
    !record.path.every(isInstallLocation) ||
    new Set(record.path).size !== record.path.length ||
    !record.path.at(-1)?.endsWith(`node_modules/${record.package}`)
  )
    errors.push(
      "path must contain distinct normalized install locations ending in the vulnerable package",
    );
  return errors;
}

/** Validate every reviewed record and its inclusive UTC review window. */
export function validateAuditExceptions(input, now) {
  const errors = [];
  const records = [];
  const seen = new Set();
  const today =
    now instanceof Date && Number.isFinite(now.getTime())
      ? calendarDay(now.toISOString().slice(0, 10))
      : undefined;
  if (today === undefined)
    errors.push("Invalid audit clock. Fix the UTC clock and retry.");
  if (!Array.isArray(input)) {
    errors.push(
      "Invalid exceptions file: expected a JSON array. Fix scripts/verification/dependency-audit-exceptions.json.",
    );
    return { errors, records };
  }
  input.forEach((exception, index) => {
    const label = `exception #${index + 1}${isRecord(exception) && typeof exception.advisory === "string" ? ` (${exception.advisory})` : ""}`;
    const invalid = schemaErrors(exception);
    if (invalid.length) {
      errors.push(
        `Invalid ${label}: ${invalid.join("; ")}. Fix or remove this record after review.`,
      );
      return;
    }
    const key = JSON.stringify([
      exception.advisory,
      exception.package,
      exception.path,
    ]);
    const daysLeft = (calendarDay(exception.until) - today) / DAY_MS;
    const record = {
      exception,
      label,
      daysLeft,
      errors: [],
      matched: false,
      used: false,
    };
    if (today === undefined)
      record.errors.push(
        `Invalid ${label}: UTC clock is invalid. Fix the clock and retry.`,
      );
    if (seen.has(key))
      record.errors.push(
        `Invalid ${label}: duplicate advisory, package, and path. Remove the duplicate record.`,
      );
    seen.add(key);
    if (daysLeft < 0)
      record.errors.push(
        `Expired ${label}: expired on ${exception.until} UTC. Remove the record or obtain a new risk review and end date.`,
      );
    else if (daysLeft > 31)
      record.errors.push(
        `Invalid ${label}: end date ${exception.until} is more than 31 days ahead. Obtain a new review and set an end date within 31 days.`,
      );
    records.push(record);
  });
  return { errors, records };
}
