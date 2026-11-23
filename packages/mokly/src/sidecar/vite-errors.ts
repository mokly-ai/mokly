import { readFileSync } from "node:fs";

import { detail, SidecarError } from "./errors.js";
import type { ModulePaths } from "./module-paths.js";
import { viteName } from "./vite-urls.js";

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
    `${viteName(paths, source)}: ${plugin}: ${message}${version ? ` (Vite ${version}; tested range ${testedViteRange()})` : ""}`,
  );
}

/** A stylesheet error always identifies the requested root, not a plugin's ID. */
export function viteStylesheetFailure(
  error: unknown,
  paths: Pick<ModulePaths, "name">,
  stylesheet: string,
): SidecarError {
  const data = error && typeof error === "object" ? error : {};
  const plugin = viteDetail(
    paths,
    "plugin" in data ? String(data.plugin) : "vite",
    stylesheet,
  );
  const message = viteDetail(paths, detail(error), stylesheet);
  return new SidecarError(
    "bundle-failed",
    `Vite plugin ${plugin} failed for ${stylesheet}: ${message}; fix the Vite setup or the stylesheet`,
  );
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
