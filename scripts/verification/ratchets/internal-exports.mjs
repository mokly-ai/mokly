import fs from "node:fs";
import path from "node:path";

import { isTypeScriptPath } from "./lines.mjs";
import { discoverUnusedInternalExports } from "./module-graph.mjs";

const BASELINE = "xtask/unused-internal-exports.txt";
const SOURCE_ROOTS = ["src", "packages/viewer/src", "scripts"];
const PACKAGE_ROOTS = ["", "packages/viewer"];

/** Compare discovered unused exports with one exact shrinking baseline. */
export function internalExportAudit({
  modules,
  publicEntrypoints,
  baseline,
  aliases,
}) {
  const unused = discoverUnusedInternalExports({
    modules,
    publicEntrypoints,
    ...(aliases ? { aliases } : {}),
  });
  const findings = baselineFormatFindings(baseline);
  const allowed = new Set(baseline);
  const discovered = new Set(unused);
  for (const key of unused) {
    if (!allowed.has(key)) findings.push(`new unused internal export: ${key}`);
  }
  for (const key of baseline) {
    if (!discovered.has(key))
      findings.push(`stale baseline entry: delete ${key}`);
  }
  return { findings: [...new Set(findings)].sort(), unused };
}

/** Audit current source exports and the reviewed baseline. */
export function auditInternalExports(repositoryRoot, git) {
  const candidateFiles = new Set(
    git
      .currentFiles(SOURCE_ROOTS)
      .filter((file) => isTypeScriptPath(file) && !isDeclarationPath(file))
      .filter((file) => fs.existsSync(path.join(repositoryRoot, file)))
      .map(normalize),
  );
  const modules = git
    .currentFiles(["."])
    .filter(isModulePath)
    .filter((file) => fs.existsSync(path.join(repositoryRoot, file)))
    .filter((file) => fs.lstatSync(path.join(repositoryRoot, file)).isFile())
    .map((file) => ({
      path: normalize(file),
      source: fs.readFileSync(path.join(repositoryRoot, file), "utf8"),
      candidate: candidateFiles.has(normalize(file)),
    }));
  const baseline = readBaseline(path.join(repositoryRoot, BASELINE));
  const publicSurface = readPublicSurface(repositoryRoot);
  const result = internalExportAudit({
    modules,
    publicEntrypoints: publicSurface.entrypoints,
    baseline,
    aliases: publicSurface.aliases,
  });
  return {
    findings: result.findings,
    summary: `${candidateFiles.size} TypeScript module(s), ${result.unused.length} baseline exception(s)`,
  };
}

function readBaseline(file) {
  const source = fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  const lines = source.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function baselineFormatFindings(baseline) {
  const findings = [];
  const sorted = [...baseline].sort();
  if (baseline.some((entry, index) => entry !== sorted[index]))
    findings.push("unused internal export baseline must be sorted");
  if (new Set(baseline).size !== baseline.length)
    findings.push("unused internal export baseline contains duplicates");
  for (const entry of baseline) {
    if (
      !/^(?:src|packages\/viewer\/src|scripts)\/[^#\s]+#[^#\s]+$/u.test(entry)
    )
      findings.push(`invalid unused internal export baseline entry: ${entry}`);
  }
  return findings;
}

function isModulePath(file) {
  return (
    /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/u.test(file) &&
    !isDeclarationPath(file)
  );
}

function isDeclarationPath(file) {
  return /\.d\.[cm]?ts$/u.test(file);
}

function readPublicSurface(repositoryRoot) {
  const entrypoints = [];
  const aliases = {};
  for (const packageRoot of PACKAGE_ROOTS) {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(repositoryRoot, packageRoot, "package.json"),
        "utf8",
      ),
    );
    for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
      for (const target of runtimeExportTargets(value)) {
        const source = sourceForExport(repositoryRoot, packageRoot, target);
        if (!source) continue;
        entrypoints.push(source);
        const specifier =
          subpath === "."
            ? manifest.name
            : `${manifest.name}/${subpath.replace(/^\.\//u, "")}`;
        aliases[specifier] = source;
      }
    }
  }
  return { aliases, entrypoints: [...new Set(entrypoints)].sort() };
}

function runtimeExportTargets(value, condition) {
  if (typeof value === "string")
    return condition === "types" || !/\.[cm]?js$/u.test(value) ? [] : [value];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, nested]) =>
    runtimeExportTargets(nested, key),
  );
}

function sourceForExport(repositoryRoot, packageRoot, target) {
  const relative = target
    .replace(/^\.\/dist\//u, "src/")
    .replace(/\.[cm]?js$/u, "");
  for (const extension of [".ts", ".tsx", ".mts", ".cts"]) {
    const candidate = normalize(
      path.posix.join(packageRoot, `${relative}${extension}`),
    );
    if (fs.existsSync(path.join(repositoryRoot, candidate))) return candidate;
  }
  return undefined;
}

function normalize(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//u, "");
}
