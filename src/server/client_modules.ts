/** Loading of the package-owned browser build outputs and shell font files. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { viewerAssetUrl } from "@mokly/viewer/server";

import { MoklyError, errorMessage } from "../errors.js";

/** Load every JavaScript browser build output before the HTTP server binds. */
export function loadBrowserClientModules(): ReadonlyMap<string, Buffer> {
  const viewerDirectory = fileURLToPath(
    new URL(".", viewerAssetUrl("browser", "asset.js")),
  );
  const cliDirectory = fileURLToPath(new URL("../browser/", import.meta.url));
  return loadBrowserClientModulesFrom(viewerDirectory, cliDirectory);
}

/** @internal Load explicit build directories for verification. */
export function loadBrowserClientModulesFrom(
  viewerDirectory: string,
  cliDirectory: string,
): ReadonlyMap<string, Buffer> {
  const candidates = new Map<string, string>();
  for (const directory of [viewerDirectory, cliDirectory]) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      throw new MoklyError(
        "server-failed",
        `could not enumerate browser client modules: ${errorMessage(error)}`,
        { cause: error },
      );
    }
    const expected = readBrowserManifest(directory);
    const actual = entries.map((entry) => entry.name).sort();
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".js"))
        throw new MoklyError(
          "server-failed",
          `unexpected browser build output: ${entry.name}`,
        );
      if (!expected.includes(entry.name))
        throw new MoklyError(
          "server-failed",
          `unexpected browser build output: ${entry.name}`,
        );
      if (candidates.has(entry.name))
        throw new MoklyError(
          "server-failed",
          `duplicate browser build output: ${entry.name}`,
        );
      candidates.set(entry.name, path.join(directory, entry.name));
    }
    for (const filename of expected)
      if (!actual.includes(filename))
        throw new MoklyError(
          "server-failed",
          `missing browser build output: ${filename}`,
        );
  }
  const modules = new Map<string, Buffer>();
  for (const [filename, candidate] of [...candidates].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    try {
      modules.set(filename, fs.readFileSync(candidate));
    } catch (error) {
      throw new MoklyError(
        "server-failed",
        `could not load browser client ${filename}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
  return modules;
}

function readBrowserManifest(directory: string): readonly string[] {
  const manifestPath = `${path.resolve(directory)}.manifest.json`;
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new MoklyError(
      "server-failed",
      `could not read browser build manifest: ${errorMessage(error)}`,
      { cause: error },
    );
  }
  if (!isBrowserManifest(value))
    throw new MoklyError("server-failed", "invalid browser build manifest");
  const sorted = [...value.modules].sort();
  if (
    new Set(sorted).size !== sorted.length ||
    sorted.some((name, index) => name !== value.modules[index])
  )
    throw new MoklyError("server-failed", "invalid browser build manifest");
  return sorted;
}

function isBrowserManifest(
  value: unknown,
): value is { schemaVersion: 1; modules: string[] } {
  return (
    value !== null &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 1 &&
    "modules" in value &&
    Array.isArray(value.modules) &&
    value.modules.every(
      (name) =>
        typeof name === "string" &&
        /^[A-Za-z0-9_.-]+\.js$/.test(name) &&
        !name.includes(".."),
    )
  );
}

/** Load shared pure navigation modules imported by the browser client. */
export function loadBrowserNavigationModules(): ReadonlyMap<string, Buffer> {
  return loadModules("../navigation", [
    "logical.js",
    "target.js",
    "delivery.js",
  ]);
}

/** Load the packaged shell fonts before the HTTP server binds. */
export function loadShellFontAssets(): ReadonlyMap<string, Buffer> {
  const fonts = new Map<string, Buffer>();
  for (const filename of ["InterVariable.woff2", "Inter-OFL.txt"]) {
    const candidate = fileURLToPath(viewerAssetUrl("fonts", filename));
    try {
      fonts.set(filename, fs.readFileSync(candidate));
    } catch (error) {
      throw new MoklyError(
        "server-failed",
        `could not load shell font ${filename}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
  return fonts;
}

function loadModules(
  _relativeDirectory: string,
  filenames: readonly string[],
): ReadonlyMap<string, Buffer> {
  const modules = new Map<string, Buffer>();
  for (const filename of filenames) {
    const candidate = fileURLToPath(viewerAssetUrl("navigation", filename));
    try {
      modules.set(filename, fs.readFileSync(candidate));
    } catch (error) {
      throw new MoklyError(
        "server-failed",
        `could not load browser module ${filename}: ${errorMessage(error)}`,
        { cause: error },
      );
    }
  }
  return modules;
}
