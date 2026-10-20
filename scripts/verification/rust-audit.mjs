import { runCommand } from "../release/command.mjs";

const ADVISORY = "RUSTSEC-2026-0235";
const LIGHTNINGCSS = "1.0.0-alpha.72";
const EXPIRES = Date.parse("2027-02-01T00:00:00.000Z");

/**
 * Enforce the reviewed exception before accepting a live Rust advisory audit.
 * Cargo parses the lockfile; cargo-audit reports its effective configuration.
 * @param {import("./rust-audit.mjs").RustAuditOptions} options
 * @returns {Promise<void>}
 */
export async function runRustAudit({
  root,
  now = () => new Date(),
  execute = runCommand,
  write = (message) => process.stdout.write(message),
}) {
  const date = now().valueOf();
  if (!Number.isFinite(date) || date >= EXPIRES)
    throw new Error(
      `Review ${ADVISORY}: its approval ends after 2027-01-31. Update the reviewed exception before auditing.`,
    );

  const metadata = await execute(
    "cargo",
    ["metadata", "--locked", "--format-version", "1"],
    { cwd: root },
  );
  write(metadata.stderr);
  const packages = parseObject(metadata.stdout).packages;
  if (!Array.isArray(packages)) throw invalidReport();
  const versions = packages.filter(
    (entry) => isObject(entry) && entry.name === "lightningcss",
  );
  if (versions.length !== 1 || versions[0].version !== LIGHTNINGCSS)
    throw new Error(
      `Review ${ADVISORY}: locked lightningcss must remain ${LIGHTNINGCSS}. Review the new dependency before auditing.`,
    );

  const installed = await execute(
    "cargo",
    ["install", "cargo-audit", "--version", "0.22.2", "--locked"],
    { cwd: root },
  );
  write(installed.stdout);
  write(installed.stderr);
  const audited = await execute(
    "cargo",
    ["audit", "--json", "--file", "Cargo.lock"],
    { cwd: root },
  );
  write(audited.stdout);
  write(audited.stderr);
  const report = parseObject(audited.stdout);
  const settings = report.settings;
  if (
    !isObject(settings) ||
    !Array.isArray(settings.ignore) ||
    settings.ignore.some((id) => typeof id !== "string")
  )
    throw invalidReport();
  if (settings.ignore.some((id) => id !== ADVISORY))
    throw new Error(
      `Only ${ADVISORY} may be ignored. Remove other ignored advisory IDs and retry.`,
    );
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {string} source @returns {Record<string, unknown>} */
function parseObject(source) {
  try {
    /** @type {unknown} */
    const value = JSON.parse(source);
    if (isObject(value)) return value;
  } catch {
    // Malformed output cannot establish the reviewed exception boundary.
  }
  throw invalidReport();
}

function invalidReport() {
  return new Error(
    "Cannot validate the Rust audit tool report. Restore the pinned tools and retry.",
  );
}
