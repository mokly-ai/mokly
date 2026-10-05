import fs from "node:fs";
import path from "node:path";

import {
  javascriptExportTargets,
  sourcePathForExport,
} from "./package-exports.mjs";
import { expandedPublicExports } from "./public-export-surface.mjs";

const RELEASE_CONFIG = "release-please-config.json";
const RELEASE_MANIFEST = ".release-please-manifest.json";
const RELEASE_NOTES = "docs/protocol/npm-release-notes.md";

/** Compare published package exports with their newest reachable releases. */
export function auditPublicPackageExports(repositoryRoot, git) {
  const releaseConfig = readCurrentJson(repositoryRoot, RELEASE_CONFIG);
  const releaseManifest = readRevisionJson(git, "HEAD", RELEASE_MANIFEST);
  const notes = inlineCodeSpans(
    fs.readFileSync(path.join(repositoryRoot, RELEASE_NOTES), "utf8"),
  );
  const findings = [];
  const baselines = [];
  let notedRemovals = 0;
  for (const [packageRoot, packageConfig] of Object.entries(
    releaseConfig.packages ?? {},
  )) {
    let releasedVersion = releaseManifest[packageRoot];
    if (releasedVersion === "0.0.0") continue;
    const currentManifest = readCurrentJson(
      repositoryRoot,
      packagePath(packageRoot, "package.json"),
    );
    if (releasedVersion === undefined) {
      const owners = revisionPackages(git, "HEAD", currentManifest.name);
      if (owners.length > 1) {
        findings.push(
          `${currentManifest.name}: multiple packages with the same name in HEAD; cannot resolve release state`,
        );
        continue;
      }
      releasedVersion =
        owners.length === 1 ? releaseManifest[owners[0].root] : undefined;
      if (releasedVersion === undefined || releasedVersion === "0.0.0")
        continue;
    }
    const pattern = `${tagPrefix(packageConfig)}[0-9]*`;
    const tag = git.newestReachableTag(pattern);
    if (!tag) {
      findings.push(
        `${currentManifest.name} records release ${releasedVersion} but no reachable tag matches ${pattern}; run git fetch --tags origin and retry`,
      );
      continue;
    }
    baselines.push(`${currentManifest.name}: ${tag}`);
    const matches = revisionPackages(git, tag, currentManifest.name);
    if (matches.length !== 1) {
      findings.push(
        `${currentManifest.name}: ${matches.length === 0 ? "no package" : "multiple packages"} with the same name in ${tag}; cannot resolve the baseline package root`,
      );
      continue;
    }
    const [{ root: baselineRoot, manifest: releasedManifest }] = matches;
    const released = packageSurface({
      exists: (file) => git.revisionFileExists(tag, file),
      label: tag,
      manifest: releasedManifest,
      packageRoot: baselineRoot,
      read: (file) => git.readRevision(tag, file).toString("utf8"),
    });
    const current = packageSurface({
      exists: (file) => fs.existsSync(path.join(repositoryRoot, file)),
      label: "current",
      manifest: currentManifest,
      packageRoot,
      read: (file) => fs.readFileSync(path.join(repositoryRoot, file), "utf8"),
    });
    findings.push(...released.findings, ...current.findings);
    const comparison = removalFindings({
      current,
      notes,
      packageName: releasedManifest.name,
      released,
      tag,
    });
    findings.push(...comparison.findings);
    notedRemovals += comparison.notedRemovals;
  }
  const baselineSummary =
    baselines.length === 0
      ? "0 released package baseline(s)"
      : baselines.join(", ");
  return {
    findings: [...new Set(findings)].sort(),
    summary: `${baselineSummary}; ${notedRemovals} noted removal(s)`,
  };
}

function revisionPackages(git, revision, packageName) {
  const roots = Object.keys(
    readRevisionJson(git, revision, RELEASE_CONFIG).packages ?? {},
  );
  return roots.flatMap((root) => {
    const file = packagePath(root, "package.json");
    if (!git.revisionFileExists(revision, file)) return [];
    const manifest = readRevisionJson(git, revision, file);
    return manifest.name === packageName ? [{ root, manifest }] : [];
  });
}

function packageSurface({ exists, label, manifest, packageRoot, read }) {
  const findings = [];
  const subpaths = new Map();
  const existence = new Map();
  const sources = new Map();
  const fileExists = (file) => {
    if (!existence.has(file)) existence.set(file, exists(file));
    return existence.get(file);
  };
  const readFile = (file) => {
    if (!sources.has(file)) sources.set(file, read(file));
    return sources.get(file);
  };
  for (const [subpath, value] of exportMapEntries(manifest.exports)) {
    const names = new Set();
    const specifier = publicSpecifier(manifest.name, subpath);
    for (const target of javascriptExportTargets(value)) {
      const source = sourcePathForExport(packageRoot, target, fileExists);
      if (!source) {
        findings.push(
          `${label} public export ${specifier} target ${target} cannot map to a source entry point`,
        );
        continue;
      }
      const exports = expandedPublicExports({
        entrypoint: source,
        fileExists,
        readFile,
      });
      for (const finding of exports.findings)
        findings.push(`${label} public export ${specifier}: ${finding}`);
      for (const name of exports.names) names.add(name);
    }
    subpaths.set(subpath, names);
  }
  return { findings, subpaths };
}

function removalFindings({ current, notes, packageName, released, tag }) {
  const findings = [];
  let notedRemovals = 0;
  for (const [subpath, releasedNames] of released.subpaths) {
    const specifier = publicSpecifier(packageName, subpath);
    const currentNames = current.subpaths.get(subpath);
    if (!currentNames) {
      if (notes.has(specifier)) {
        notedRemovals += 1;
      } else {
        findings.push(
          `${specifier} was removed since ${tag}; name the removed subpath as an exact inline code span in npm-release-notes.md`,
        );
      }
      continue;
    }
    for (const name of releasedNames) {
      if (currentNames.has(name)) continue;
      if (notes.has(name)) {
        notedRemovals += 1;
      } else {
        findings.push(
          `${specifier} removed export ${name} since ${tag}; name the removed export as an exact inline code span in npm-release-notes.md`,
        );
      }
    }
  }
  return { findings, notedRemovals };
}

function exportMapEntries(exports) {
  if (typeof exports === "string" || Array.isArray(exports))
    return [[".", exports]];
  if (!exports || typeof exports !== "object") return [];
  const entries = Object.entries(exports);
  if (entries.length === 0) return [];
  return entries.some(([key]) => key.startsWith("."))
    ? entries
    : [[".", exports]];
}

function inlineCodeSpans(source) {
  const spans = new Set();
  for (const match of source.matchAll(/(?<!`)`([^`\r\n]+)`(?!`)/gu))
    spans.add(match[1]);
  return spans;
}

function tagPrefix(config) {
  const component = config["include-component-in-tag"]
    ? `${config.component}-`
    : "";
  const version = config["include-v-in-tag"] ? "v" : "";
  return `${component}${version}`;
}

function publicSpecifier(packageName, subpath) {
  return subpath === "."
    ? packageName
    : `${packageName}/${subpath.replace(/^\.\//u, "")}`;
}

function packagePath(packageRoot, file) {
  return packageRoot === "." ? file : path.posix.join(packageRoot, file);
}

function readCurrentJson(repositoryRoot, file) {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, file), "utf8"));
}

function readRevisionJson(git, revision, file) {
  return JSON.parse(git.readRevision(revision, file).toString("utf8"));
}
