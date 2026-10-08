/** Candidate policies and one shared import graph for both export scopes. */

import { isSourceModulePath } from "./lines.mjs";
import { discoverUnusedInternalExports } from "./module-graph.mjs";
import { normalizeModulePath } from "./module-resolution.mjs";

/** Preserve the existing source-root policy, baseline, and diagnostics. */
export const INTERNAL_EXPORT_SCOPE = {
  id: "internal",
  roots: ["src", "packages/viewer/src", "scripts"],
  baseline: "xtask/unused-internal-exports.txt",
  label: "unused internal export",
  moduleLabel: "JavaScript/TypeScript",
  baselinePattern: /^(?:src|packages\/viewer\/src|scripts)\/[^#\s]+#[^#\s]+$/u,
  excludes: () => false,
};

/** Audit helper modules while retaining other modules as importers. */
export const TEST_HELPER_EXPORT_SCOPE = {
  id: "testHelpers",
  roots: ["tests", "packages/viewer/tests"],
  baseline: "xtask/unused-test-helper-exports.txt",
  label: "unused test helper export",
  moduleLabel: "test helper",
  baselinePattern: /^(?:tests|packages\/viewer\/tests)\/[^#\s]+#[^#\s]+$/u,
  excludes: (file) =>
    /(?:\.test\.tsx?|\.spec\.ts)$/u.test(file) ||
    file.startsWith("tests/fixtures/"),
};

/** Declaration files are neither candidates nor importers in either scope. */
export function isExportModulePath(file) {
  return isSourceModulePath(file) && !/\.d\.[cm]?ts$/u.test(file);
}

/** Parse each module once, then partition unused keys and candidate counts. */
export function analyzeExportScopes({ modules, publicEntrypoints, aliases }) {
  const scopes = [INTERNAL_EXPORT_SCOPE, TEST_HELPER_EXPORT_SCOPE];
  const candidates = new Map(scopes.map((scope) => [scope.id, new Set()]));
  const graph = modules
    .filter((module) => isExportModulePath(module.path))
    .map((module) => {
      const file = normalizeModulePath(module.path);
      let candidate = false;
      for (const scope of scopes) {
        if (
          !scope.roots.some((root) => file.startsWith(`${root}/`)) ||
          scope.excludes(file)
        )
          continue;
        candidates.get(scope.id).add(file);
        candidate = true;
      }
      return { ...module, path: file, candidate };
    });
  const unused = discoverUnusedInternalExports({
    modules: graph,
    publicEntrypoints,
    aliases,
  });
  return Object.fromEntries(
    scopes.map((scope) => [
      scope.id,
      {
        moduleCount: candidates.get(scope.id).size,
        unused: unused.filter((key) =>
          scope.roots.some((root) => key.startsWith(`${root}/`)),
        ),
      },
    ]),
  );
}
