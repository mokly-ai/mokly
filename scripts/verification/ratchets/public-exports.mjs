import fs from "node:fs";
import path from "node:path";

import {
  javascriptExportTargets,
  sourcePathForExport,
} from "./package-exports.mjs";
import { expandedPublicExports } from "./public-export-surface.mjs";

const RELEASE_CONFIG = "release-please-config.json";
const RELEASE_MANIFEST = ".release-please-manifest.json";
const RELEASE_NOTES = "docs/guides/start/upgrade.md";

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
  const components = { ...releaseConfig.packages };
  if (
    components["."]?.["package-name"] === "@mokly/mokly" &&
    !components["packages/viewer"]
  ) {
    // The root release owns two JavaScript packages with separate tag histories.
    components["packages/viewer"] = {
      component: "viewer",
      "include-component-in-tag": true,
      "include-v-in-tag": true,
    };
    releaseManifest["packages/viewer"] ??= releaseManifest["."];
  }
  for (const [componentRoot, packageConfig] of Object.entries(components)) {
    const releasedVersion = releaseManifest[componentRoot];
    if (releasedVersion === undefined || releasedVersion === "0.0.0") continue;
    const packageRoot = publicPackageRoot(
      repositoryRoot,
      componentRoot,
      packageConfig,
    );
    const currentManifest = readCurrentJson(
      repositoryRoot,
      packagePath(packageRoot, "package.json"),
    );
    const pattern = `${tagPrefix(packageConfig)}[0-9]*`;
    const tag = git.newestReachableTag(pattern);
    if (!tag) {
      findings.push(
        `${currentManifest.name} records release ${releasedVersion} but no reachable tag matches ${pattern}; run git fetch --tags origin and retry`,
      );
      continue;
    }
    baselines.push(`${currentManifest.name}: ${tag}`);
    const releasedRoot = releasedPackageRoot(
      git,
      tag,
      packageRoot,
      currentManifest.name,
    );
    const releasedManifest = readRevisionJson(
      git,
      tag,
      packagePath(releasedRoot, "package.json"),
    );
    const released = packageSurface({
      exists: (file) => git.revisionFileExists(tag, file),
      label: tag,
      manifest: releasedManifest,
      packageRoot: releasedRoot,
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
          `${specifier} was removed since ${tag}; name the removed subpath as an exact inline code span in docs/guides/start/upgrade.md`,
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
          `${specifier} removed export ${name} since ${tag}; name the removed export as an exact inline code span in docs/guides/start/upgrade.md`,
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

function releasedPackageRoot(git, tag, currentRoot, name) {
  const currentPath = packagePath(currentRoot, "package.json");
  if (
    git.revisionFileExists(tag, currentPath) &&
    readRevisionJson(git, tag, currentPath).name === name
  )
    return currentRoot;
  const config = readRevisionJson(git, tag, RELEASE_CONFIG);
  const matches = Object.keys(config.packages ?? {}).filter((root) => {
    const file = packagePath(root, "package.json");
    return (
      git.revisionFileExists(tag, file) &&
      readRevisionJson(git, tag, file).name === name
    );
  });
  if (matches.length !== 1)
    throw new Error(`${name} has no unique package location at ${tag}`);
  return matches[0];
}

/** A release component can own a public package beneath the private root. */
function publicPackageRoot(repositoryRoot, componentRoot, config) {
  const component = readCurrentJson(
    repositoryRoot,
    packagePath(componentRoot, "package.json"),
  );
  const name = config["package-name"] ?? component.name;
  if (component.name === name) return componentRoot;
  const workspace = readCurrentJson(repositoryRoot, "package.json");
  const roots = Array.isArray(workspace.workspaces) ? workspace.workspaces : [];
  const matches = roots.filter((root) => {
    const manifest = readCurrentJson(
      repositoryRoot,
      packagePath(root, "package.json"),
    );
    return manifest.name === name && manifest.private !== true;
  });
  if (matches.length !== 1)
    throw new Error(`${name} has no unique public workspace package`);
  return matches[0];
}
