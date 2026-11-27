import { isBuiltin } from "node:module";

import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import type { BuildResult } from "esbuild";

import { runtimeRequireWarnings } from "./bundle-options.js";
import { cssModulePrefix } from "./css-modules.js";

/** Detect runtime loads that leave no import edge. */
function usesRuntimeRequire(code: string): boolean {
  if (code.includes("getBuiltinModule")) return true;
  if (!/\brequire\b(?!\s*\()|\bnew\s+(?:require\b|\/[/*])/.test(code))
    return false;

  try {
    let found = false;
    traverseModule.default(parse(code, { sourceType: "commonjs" }), {
      ReferencedIdentifier(reference) {
        const { node, parent, scope } = reference;
        if (node.name !== "require" || scope.hasBinding("require")) return;
        if (parent.type === "CallExpression" && parent.callee === node) return;
        found = true;
        reference.stop();
      },
    });
    return found;
  } catch {
    return true;
  }
}

/** Check for emitted requires whose targets are outside the captured resolution. */
export function hasUnresolvedRequire(
  compiled: Pick<BuildResult, "metafile" | "outputFiles" | "warnings">,
  peers: Record<string, string | null>,
  runtimeKey: string,
): boolean {
  if (
    compiled.warnings.some(({ id }) =>
      Object.hasOwn(runtimeRequireWarnings, id),
    )
  )
    return true;
  const resolvedPeers = new Set(Object.values(peers));
  return (
    Object.values(compiled.metafile!.outputs).some(({ imports }) =>
      imports.some(
        ({ external, kind, path }) =>
          external &&
          (path === "module" ||
            path === "node:module" ||
            (kind === "require-call" &&
              !isBuiltin(path) &&
              !Object.hasOwn(peers, path) &&
              !resolvedPeers.has(path) &&
              path !== runtimeKey &&
              !path.startsWith(runtimeKey + cssModulePrefix))),
      ),
    ) || compiled.outputFiles!.some(({ text }) => usesRuntimeRequire(text))
  );
}
