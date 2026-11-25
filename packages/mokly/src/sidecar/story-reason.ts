import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { types } from "node:util";

import type { Generation } from "./bundle.js";
import { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import { resolutionOptions } from "./resolution.js";

const pathStart = /(?:file:|[a-z]:[\\/]|\\\\|\/)/;
const otherUrl = /\b(?!file:)[a-z][a-z\d+.-]+:\/\/[^\s"'`<>),;]+/;
const fileUrlStart = /file:(?=\/|[a-z]:[\\/])/;
const barePathBoundary = /(?:(?<![\w@./\\<-])|(?<=<)(?!\/[a-z][\w:-]*\s*>))/;
const barePathTail = /[^\s"'`<>[\]«»),;]*/;
const rootEnd = /(?=$|[\s"'`<>[\]«»),;:?#])/;
const pathInReason = pathMatcher([]);
const webUrls = new RegExp(otherUrl.source, "giu");
const names = new WeakMap<Generation, ModulePaths>();

interface KnownRoot {
  file: string;
  real: string;
  windows: boolean;
  redact: boolean;
}

export function storyReason(generation: Generation, error: unknown): string {
  const text = thrownText(error);
  const roots = knownRoots(generation);
  const spellings = orderedPatterns([...roots.keys()]);
  const root = `(?:${spellings.join("|") || "(?!)"})`;
  const leadingRoot = new RegExp(`^${root}(?=$|[\\\\/])`, "iu");
  const knownPath = `${root}(?:[\\\\/]${barePathTail.source}|${rootEnd.source})`;
  const pathsAnywhere = new RegExp(knownPath, "giu");
  const rootsWithSpaces = [...roots.keys()].filter((root) =>
    /[^\S\r\n]/u.test(root),
  );
  const matcher = rootsWithSpaces.length
    ? pathMatcher(rootsWithSpaces)
    : pathInReason;

  const message = text.replace(
    matcher,
    (value, quote?: string, quotedPath?: string, url?: string) => {
      if (quote && quotedPath) return quote + namePath(quotedPath) + quote;
      return url ? value : nameLocation(value);
    },
  );
  const urls = message.matchAll(webUrls);
  let url = urls.next().value;
  return message
    .replace(pathsAnywhere, (file, offset: number) => {
      while (url && offset >= url.index + url[0].length)
        url = urls.next().value;
      if (url && offset >= url.index) {
        const authority = url.index + url[0].indexOf("://") + 3;
        if (offset < authority) return file;
        // The absolute path can also supply the URL's path separator.
        if (file.startsWith("/") && message[offset - 1] !== "/")
          return "/" + nameLocation(file);
      }
      return nameLocation(file);
    })
    .toWellFormed();

  function nameLocation(value: string): string {
    const position = /:\d+(?::\d+)?$/u.exec(value);
    const file = position ? value.slice(0, position.index) : value;
    return namePath(file) + (position?.[0] ?? "");
  }

  function namePath(value: string): string {
    try {
      const spelling = leadingRoot.exec(value)?.[0];
      const known =
        spelling === undefined ? undefined : lookupRoot(roots, spelling);
      if (known?.redact) return "…";
      const file = /^file:/iu.test(value)
        ? fileURLToPath(value, { windows: known?.windows ?? path.sep === "\\" })
        : value;
      const canonical = known
        ? known.real + file.slice(known.file.length)
        : file;
      return logicalPath(generation, canonical, known?.real);
    } catch {
      return "…";
    }
  }
}

function thrownText(error: unknown): string {
  try {
    if (types.isNativeError(error))
      return String(error.message ?? "") || String(error.name);
    return String(error);
  } catch {
    return "Unknown error";
  }
}

function knownRoots(generation: Generation): Map<string, KnownRoot> {
  const roots = new Map<string, KnownRoot>();
  const { sourceRoot, moduleResolution } = generation.params;
  for (const root of new Set([
    sourceRoot,
    ...generation.dependencyRoots,
    ...resolutionOptions(sourceRoot, moduleResolution).nodePaths,
    moduleResolution.dependencyRoot,
  ])) {
    if (root !== undefined) add(root, false);
  }
  add(os.homedir(), true);
  add(os.tmpdir(), true);
  return roots;

  function add(root: string, redact: boolean): void {
    const windows = path.sep === "\\" || /^(?:[a-z]:[\\/]|\\\\)/iu.test(root);
    const platform = windows ? path.win32 : path.posix;
    if (!platform.isAbsolute(root)) return;
    const plain = platform.resolve(root);
    const real = path.isAbsolute(plain) ? realPath(plain) : plain;
    for (const file of new Set([plain, real])) {
      if (file === platform.parse(file).root) continue;
      const paths = [file, pathToFileURL(file, { windows }).href];
      if (windows) paths.push(file.replaceAll("\\", "/"));
      for (const spelling of paths) {
        if (!roots.has(spelling))
          roots.set(spelling, { file, real, windows, redact });
      }
    }
  }
}

function lookupRoot(
  roots: Map<string, KnownRoot>,
  spelling: string,
): KnownRoot | undefined {
  const key = spelling.replace(/^file:/iu, "file:");
  const exact = roots.get(key);
  if (exact) return exact;
  const lower = key.toLowerCase();
  return [...roots].find(
    ([alias, root]) => root.windows && alias.toLowerCase() === lower,
  )?.[1];
}

function realPath(file: string): string {
  try {
    return realpathSync(file);
  } catch {
    return file;
  }
}

function orderedPatterns(roots: string[]): string[] {
  return roots
    .toSorted((a, b) => b.length - a.length)
    .map((root) => root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
}

function pathMatcher(roots: string[]): RegExp {
  const starts = orderedPatterns(roots);
  starts.push(pathStart.source);
  const quoted = /(["'`])((?:file:|[a-z]:[\\/]|\\\\|\/)[^"'`\r\n]*)\1/;
  const bare = `(?:${fileUrlStart.source}|${barePathBoundary.source}(?:${starts.join("|")}))${barePathTail.source}`;
  return new RegExp(`${quoted.source}|(${otherUrl.source})|${bare}`, "giu");
}

function logicalPath(
  generation: Generation,
  file: string,
  knownRoot?: string,
): string {
  if (!path.isAbsolute(file)) return "…";
  try {
    let paths = names.get(generation);
    if (!paths) {
      paths = ModulePaths.createSync(generation.params);
      names.set(generation, paths);
    }
    return paths.name(file) || ".";
  } catch {
    const root = knownRoot ?? generation.params.sourceRoot;
    return inside(root, file) ? logical(root, file) || "." : "…";
  }
}
