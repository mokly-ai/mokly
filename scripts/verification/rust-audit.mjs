import { runCommand } from "../release/command.mjs";

import { ensureRustAuditTool } from "./rust-audit-tool.mjs";

const ADVISORY = "RUSTSEC-2026-0235";
const LIGHTNINGCSS = "1.0.0-alpha.72";
const EXPIRES = Date.parse("2027-02-01T00:00:00.000Z");

/**
 * Enforce the reviewed exception before accepting a live Rust advisory audit.
 * Cargo parses the lockfile; cargo-audit reports its effective configuration.
 * The installer returns the pinned tool, built from verified source with the
 * reviewed tool lock. A cached tool still runs the live audit.
 * @param {import("./rust-audit.mjs").RustAuditOptions} options
 * @returns {Promise<void>}
 */
export async function runRustAudit({
  root,
  now = () => new Date(),
  execute = runCommand,
  install = ensureRustAuditTool,
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

  const tool = await install(root);
  const audited = await execute(
    tool,
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
  if (
    ("severity" in settings && settings.severity !== null) ||
    hasTargetFilter(settings, "target_arch") ||
    hasTargetFilter(settings, "target_os")
  )
    throw new Error(
      "Rust audit settings cannot filter advisories by severity or target.",
    );
}

/** @param {Record<string, unknown>} settings @param {string} key */
function hasTargetFilter(settings, key) {
  if (!(key in settings)) return false;
  const targets = settings[key];
  if (!Array.isArray(targets)) throw invalidReport();
  return targets.length > 0;
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
