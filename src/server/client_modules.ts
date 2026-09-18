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
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".js"))
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
