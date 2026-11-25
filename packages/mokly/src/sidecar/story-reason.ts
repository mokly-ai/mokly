import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { types } from "node:util";

import type { Generation } from "./bundle.js";
import { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import { resolutionOptions } from "./resolution.js";

const pathStart = /(?:file:(?=\/|[a-z]:[\\/])|[a-z]:[\\/]|\\\\|\/)/;
const absolutePath = new RegExp(`^${pathStart.source}`, "iu");
const urlStart = /\b(?!file:)[a-z][a-z\d+.-]*:\/\//;
const urlAuthority = /[^/?#\s"'`<>«»),;]*/;
const urlTail = /[^\s"'`<>«»),;]*/;
const pathBoundary = /(?<![\w./\\-])(?!(?<=<)\/[a-z][\w:-]*\s*>)/;
const vitePrefix = `(?:${urlStart.source}${urlAuthority.source}|${pathBoundary.source})\\/@fs\\/`;
const viteRoute = new RegExp(`^${vitePrefix}`, "iu");
const pathCharacter = /[^\s"'`<>[\]«»),;]/;
const rootEnd = /(?=$|[\s"'`<>[\]«»),;:?#])/;
const authorityDrive = /\/(?=[a-z]:[\\/]|\\\\)/;
const leadingAuthorityDrive = new RegExp(`^${authorityDrive.source}`, "iu");
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
  const spellings = [...roots.keys()];
  const root = rootPattern(spellings);
  const leadingRoot = new RegExp(`^${root}(?=$|[\\\\/])`, "iu");
  return text
    .replace(
      pathMatcher(spellings, root),
      (
        value,
        quote?: string,
        quotedPath?: string,
        route?: string,
        vitePath?: string,
        authority?: string,
        authorityPath?: string,
        url?: string,
      ) => {
        if (quote && quotedPath) {
          const prefix = viteRoute.exec(quotedPath)?.[0];
          const name = prefix
            ? nameVitePath(prefix, quotedPath.slice(prefix.length))
            : namePath(quotedPath);
          return quote + name + quote;
        }
        if (route && vitePath) return nameVitePath(route, vitePath);
        if (authority && authorityPath) {
          const file = authorityPath.replace(leadingAuthorityDrive, "");
          return `${authority}/${nameLocation(file)}`;
        }
        return url ? value : nameLocation(value);
      },
    )
    .toWellFormed();

  function nameVitePath(prefix: string, value: string): string {
    if (!value) return prefix;
    const file = absolutePath.test(value) ? value : `/${value}`;
    return prefix + nameLocation(file);
  }

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

function rootPattern(roots: string[]): string {
  const spellings = roots
    .toSorted((a, b) => b.length - a.length)
    .map((root) => root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  return `(?:${spellings.join("|") || "(?!)"})`;
}

function pathMatcher(roots: string[], root: string): RegExp {
  const tail = `${pathCharacter.source}*`;
  const suffix = `(?:[\\\\/]${tail}|${rootEnd.source})`;
  const known = `${root}${suffix}`;
  const viteRoots = rootPattern(
    roots.flatMap((root) =>
      root.startsWith("/") ? [root, root.slice(1)] : [root],
    ),
  );
  const quoted = `(["'\x60])((?:${pathStart.source}|${vitePrefix})[^"'\x60\\r\\n]*)\\1`;
  const vite = `(${vitePrefix})(${viteRoots}${suffix}|${pathCharacter.source}+)`;
  const emptyAuthority = `(${urlStart.source})(?=/)((?:${authorityDrive.source})?${known})`;
  const otherUrl = `(${urlStart.source}${urlTail.source})`;
  const bare = `${pathBoundary.source}(?:${known}|${pathStart.source}${tail})`;
  return new RegExp(
    [quoted, vite, emptyAuthority, otherUrl, bare].join("|"),
    "giu",
  );
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
