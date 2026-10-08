import fs from "node:fs";
import path from "node:path";

import {
  analyzeExportScopes,
  INTERNAL_EXPORT_SCOPE,
  isExportModulePath,
  TEST_HELPER_EXPORT_SCOPE,
} from "./export-scopes.mjs";
import { discoverUnusedInternalExports } from "./module-graph.mjs";
import {
  javascriptExportTargets,
  sourcePathForExport,
} from "./package-exports.mjs";

const PACKAGE_ROOTS = ["", "packages/viewer"];

/** Compare discovered unused exports with one exact shrinking baseline. */
export function internalExportAudit({
  modules,
  publicEntrypoints,
  baseline,
  baselineAtComparison,
  aliases,
}) {
  const unused = discoverUnusedInternalExports({
    modules,
    publicEntrypoints,
    ...(aliases ? { aliases } : {}),
  });
  return exportScopeAudit(
    { unused, baseline, baselineAtComparison },
    INTERNAL_EXPORT_SCOPE,
  );
}

/** Compare one scope's discovered keys with its own exact shrinking baseline. */
export function exportScopeAudit(
  { unused, baseline, baselineAtComparison },
  scope,
) {
  const findings = baselineFormatFindings(baseline, scope);
  const allowed = new Set(baseline);
  const discovered = new Set(unused);
  if (baselineAtComparison) {
    const comparisonEntries = new Set(baselineAtComparison);
    for (const key of baseline) {
      if (!comparisonEntries.has(key))
        findings.push(
          `baseline entry was not present at the comparison commit: ${key}`,
        );
    }
  }
  for (const key of unused) {
    if (!allowed.has(key)) findings.push(`new ${scope.label}: ${key}`);
  }
  for (const key of baseline) {
    if (!discovered.has(key))
      findings.push(`stale baseline entry: delete ${key}`);
  }
  return { findings: [...new Set(findings)].sort(), unused };
}

/** Lazily share one graph result or one operational failure across both audits. */
export function createExportAnalysis(repositoryRoot, git) {
  let outcome;
  return () => {
    if (!outcome) {
      try {
        const { modules, internalModuleCount } = readModules(
          repositoryRoot,
          git,
        );
        const surface = readPublicSurface(repositoryRoot);
        outcome = {
          value: analyzeExportScopes({
            modules,
            publicEntrypoints: surface.entrypoints,
            aliases: surface.aliases,
          }),
        };
        outcome.value.internal.moduleCount = internalModuleCount;
      } catch (error) {
        outcome = { error };
      }
    }
    if ("error" in outcome) throw outcome.error;
    return outcome.value;
  };
}

/** Audit current source exports without changing the existing scope's output. */
export function auditInternalExports(
  repositoryRoot,
  git,
  analyze = createExportAnalysis(repositoryRoot, git),
) {
  return auditScopeExports(repositoryRoot, git, INTERNAL_EXPORT_SCOPE, analyze);
}

/** Audit test helper exports with a separate baseline and separate diagnostics. */
export function auditTestHelperExports(
  repositoryRoot,
  git,
  analyze = createExportAnalysis(repositoryRoot, git),
) {
  return auditScopeExports(
    repositoryRoot,
    git,
    TEST_HELPER_EXPORT_SCOPE,
    analyze,
  );
}

/** Keep the source scope's existing count while parsing only regular modules. */
function readModules(repositoryRoot, git) {
  const files = git
    .currentFiles(["."])
    .filter(isExportModulePath)
    .filter((file) => fs.existsSync(path.join(repositoryRoot, file)));
  const internalModuleCount = new Set(
    files
      .map(normalize)
      .filter((file) =>
        INTERNAL_EXPORT_SCOPE.roots.some((root) => file.startsWith(`${root}/`)),
      ),
  ).size;
  const modules = files
    .filter((file) => fs.lstatSync(path.join(repositoryRoot, file)).isFile())
    .map((file) => ({
      path: normalize(file),
      source: fs.readFileSync(path.join(repositoryRoot, file), "utf8"),
    }));
  return { modules, internalModuleCount };
}

function auditScopeExports(repositoryRoot, git, scope, analyze) {
  const { unused, moduleCount } = analyze()[scope.id];
  const baseline = readBaseline(path.join(repositoryRoot, scope.baseline));
  const baselineAtComparison = git.baseFileExists(scope.baseline)
    ? parseBaseline(git.readBase(scope.baseline))
    : undefined;
  const result = exportScopeAudit(
    { unused, baseline, baselineAtComparison },
    scope,
  );
  return {
    findings: result.findings,
    summary: `${moduleCount} ${scope.moduleLabel} module(s), ${unused.length} baseline exception(s)`,
  };
}

function readBaseline(file) {
  return parseBaseline(fs.readFileSync(file));
}

function parseBaseline(value) {
  const source = value.toString("utf8").replaceAll("\r\n", "\n");
  const lines = source.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function baselineFormatFindings(baseline, scope) {
  const findings = [];
  const sorted = [...baseline].sort();
  if (baseline.some((entry, index) => entry !== sorted[index]))
    findings.push(`${scope.label} baseline must be sorted`);
  if (new Set(baseline).size !== baseline.length)
    findings.push(`${scope.label} baseline contains duplicates`);
  for (const entry of baseline) {
    if (!scope.baselinePattern.test(entry))
      findings.push(`invalid ${scope.label} baseline entry: ${entry}`);
  }
  return findings;
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
      for (const target of javascriptExportTargets(value)) {
        const source = sourcePathForExport(packageRoot, target, (file) =>
          fs.existsSync(path.join(repositoryRoot, file)),
        );
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

function normalize(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//u, "");
}
