import path from "node:path";
import { fileURLToPath } from "node:url";
import { types } from "node:util";

import type { Generation } from "./bundle.js";
import { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";

const pathStart = /(?:file:|[a-z]:[\\/]|\\\\|\/)/;
const otherUrl = /\b(?!file:)[a-z][a-z\d+.-]+:\/\/[^\s"'`<>),;]+/;
const barePathBoundary = /(?<![\w@./\\<-])/;
const barePathTail = /[^\s"'`<>),;]*/;
const pathInReason = pathMatcher([]);
const names = new WeakMap<Generation, ModulePaths>();

export function storyReason(generation: Generation, error: unknown): string {
  const message = types.isNativeError(error)
    ? error.message || error.name
    : String(error);
  const rootsWithSpaces = [
    generation.params.sourceRoot,
    generation.params.moduleResolution.dependencyRoot,
    ...generation.dependencyRoots,
  ].filter(
    (root): root is string => root !== undefined && /[^\S\r\n]/u.test(root),
  );
  const matcher = rootsWithSpaces.length
    ? pathMatcher(rootsWithSpaces)
    : pathInReason;
  return message.replace(
    matcher,
    (value, quote?: string, quotedPath?: string, url?: string) => {
      if (quote && quotedPath)
        return quote + logicalPath(generation, quotedPath) + quote;
      if (url) return value;
      const position = /:\d+(?::\d+)?$/u.exec(value);
      const file = position ? value.slice(0, position.index) : value;
      return logicalPath(generation, file) + (position?.[0] ?? "");
    },
  );
}

function pathMatcher(roots: string[]): RegExp {
  const starts = roots
    .toSorted((a, b) => b.length - a.length)
    .map((root) => root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  starts.push(pathStart.source);
  const quoted = /(["'`])((?:file:|[a-z]:[\\/]|\\\\|\/)[^"'`\r\n]*)\1/;
  const bare = `${barePathBoundary.source}(?:${starts.join("|")})${barePathTail.source}`;
  return new RegExp(`${quoted.source}|(${otherUrl.source})|${bare}`, "giu");
}

function logicalPath(generation: Generation, value: string): string {
  try {
    const file = /^file:/iu.test(value) ? fileURLToPath(value) : value;
    if (!path.isAbsolute(file)) return "…";
    try {
      let paths = names.get(generation);
      if (!paths) {
        paths = ModulePaths.createSync(generation.params);
        names.set(generation, paths);
      }
      return paths.name(file) || ".";
    } catch {
      const root = generation.params.sourceRoot;
      return inside(root, file) ? logical(root, file) || "." : "…";
    }
  } catch {
    return "…";
  }
}
