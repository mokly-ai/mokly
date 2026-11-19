import { readFileSync } from "node:fs";
import path from "node:path";

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
  const message = detail(error)
    .replace(
      /(?<![\w@./-])(?:file:\/\/)?(?:[A-Za-z]:[\\/]|\/)[^\s"'`<>),;]+/g,
      (file) => {
        try {
          return viteName(paths, file);
        } catch {
          return path.basename(file);
        }
      },
    )
    .replace(/\0[^\s"'`]+|\b(?:virtual:|mokly:)[^\s"'`]+/g, "entry module");
  return new SidecarError(
    "bundle-failed",
    `${viteName(paths, source)}: ${plugin}: ${message}${version ? ` (Vite ${version}; tested range ${testedViteRange()})` : ""}`,
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
