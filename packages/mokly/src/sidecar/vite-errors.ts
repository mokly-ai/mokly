import { readFileSync } from "node:fs";
import path from "node:path";

import { detail, SidecarError } from "./errors.js";
import type { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import { viteFile, viteName } from "./vite-urls.js";

/** Ask the pool to start the request with empty Node module caches. */
export class FreshViteWorker extends SidecarError {
  constructor() {
    super("fresh-worker-required", "Vite needs a fresh worker process");
  }
}

/** Keep plugin diagnostics in logical source space, including their embedded paths. */
export function viteFailure(
  error: unknown,
  paths: Pick<ModulePaths, "name">,
  id: string,
  version?: string,
): SidecarError {
  if (error instanceof SidecarError) return error;
  const data = error && typeof error === "object" ? error : {};
  const plugin = "plugin" in data ? String(data.plugin) : "vite";
  const source = "id" in data && typeof data.id === "string" ? data.id : id;
  const message = viteDetail(paths, detail(error));
  return new SidecarError(
    "bundle-failed",
    `${viteName(paths, source)}: ${plugin}: ${message}${viteVersion(version)}`,
  );
}

export function viteEvaluationFailure(
  error: unknown,
  paths: Pick<ModulePaths, "name">,
  version: string,
  module?: string,
): SidecarError {
  if (error instanceof SidecarError) return error;
  const message = viteDetail(paths, detail(error), "virtual module");
  return new SidecarError(
    "bundle-failed",
    module === undefined
      ? `Vite evaluation: ${message}${viteVersion(version)}`
      : `${module}: ${message}`,
  );
}

type StylesheetPaths = Pick<ModulePaths, "name" | "sourceRoot">;

export function viteStylesheetFailure(
  error: unknown,
  paths: StylesheetPaths,
  stylesheet: string,
): SidecarError {
  const data = isRecord(error) ? error : {};
  const plugin = viteDetail(
    paths,
    "plugin" in data ? String(data.plugin) : "vite",
    stylesheet,
  );
  const message = viteDetail(paths, detail(error), stylesheet);
  const location = stylesheetLocation(paths, stylesheet, data);
  return new SidecarError(
    "bundle-failed",
    `Vite plugin ${plugin} failed for ${location}: ${message}; fix the Vite setup or the stylesheet`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stylesheetLocation(
  paths: StylesheetPaths,
  stylesheet: string,
  error: Record<string, unknown>,
): string {
  const span = error.span;
  if (isRecord(span)) {
    const { start, url } = span;
    if (
      isRecord(start) &&
      typeof start.line === "number" &&
      typeof start.column === "number"
    ) {
      return position(
        paths,
        stylesheet,
        url instanceof URL ? url.href : (url ?? error.id),
        start.line + 1,
        start.column + 1,
      );
    }
  }
  const loc = error.loc;
  if (
    !isRecord(loc) ||
    typeof loc.line !== "number" ||
    typeof loc.column !== "number"
  )
    return stylesheet;
  return position(
    paths,
    stylesheet,
    loc.file ?? error.id,
    loc.line,
    loc.column + 1,
  );
}

function position(
  paths: StylesheetPaths,
  stylesheet: string,
  id: unknown,
  line: number,
  column: number,
): string {
  if (
    !Number.isInteger(line) ||
    !Number.isInteger(column) ||
    line < 1 ||
    column < 1
  )
    return stylesheet;
  if (typeof id !== "string" || id === "")
    return `${stylesheet}:${line}:${column}`;
  if (id.includes("\0") || id.startsWith("/@id/")) return stylesheet;
  try {
    const file =
      viteFile(id) ??
      (!id.includes(":")
        ? path.resolve(paths.sourceRoot, id.replace(/[?#].*$/, ""))
        : undefined);
    if (!file || !inside(paths.sourceRoot, file)) return stylesheet;
    const name = logical(paths.sourceRoot, file);
    return name ? `${name}:${line}:${column}` : stylesheet;
  } catch {
    return stylesheet;
  }
}

function viteDetail(
  paths: Pick<ModulePaths, "name">,
  message: string,
  logical = "entry module",
): string {
  return message
    .replace(
      /\0[^\s"'`<>),;]+|\b(?:virtual:|mokly:)[^\s"'`<>),;]+|\/@id\/[^\s"'`<>),;]+/g,
      logical,
    )
    .replace(
      /(?<![\w@./-])(?:file:\/\/)?(?:[A-Za-z]:[\\/]|\/)[^\s"'`<>),;]+/g,
      (file) => {
        const location = /:\d+(?::\d+)?$/.exec(file);
        const name = location ? file.slice(0, location.index) : file;
        return viteName(paths, name) + (location?.[0] ?? "");
      },
    );
}

function viteVersion(version: string | undefined): string {
  return version ? ` (Vite ${version}; tested range ${testedViteRange()})` : "";
}

function testedViteRange(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  const peers =
    manifest && typeof manifest === "object" && "peerDependencies" in manifest
      ? manifest.peerDependencies
      : undefined;
  return peers &&
    typeof peers === "object" &&
    "vite" in peers &&
    typeof peers.vite === "string"
    ? peers.vite
    : "not declared";
}
