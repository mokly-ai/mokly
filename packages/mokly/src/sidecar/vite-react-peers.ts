import fs from "node:fs/promises";
import path from "node:path";

import { missingFile } from "./file-digests.js";
import { viteExternal } from "./vite-external.js";
import type { ViteLookup } from "./vite-resolution.js";
import {
  viteDependencyJsx,
  viteFile,
  viteJsx,
  viteProductionJsx,
} from "./vite-urls.js";

export type VitePeers = Record<string, string | null>;
const reactImport = /^(react|react-dom)(?:\/.*)?$/;

/** Claim React specifiers using the copies selected by the setup. */
export function viteReactImport(
  source: string,
  peers: VitePeers,
  repositoryOwned: boolean,
): string | undefined {
  if (!reactImport.test(source)) return;
  if (source === "react/jsx-dev-runtime")
    return repositoryOwned ? viteJsx : viteDependencyJsx;
  const file = peers[source];
  if (typeof file !== "string") throw missingPeer(source);
  if (source === "react/jsx-runtime" && repositoryOwned)
    return viteProductionJsx;
  return viteExternal(file);
}

/** Resolve every public React entry after the setup selects the package copies. */
export async function captureReactPeers(
  lookup: ViteLookup,
): Promise<VitePeers> {
  const peers: VitePeers = {};
  for (const name of ["react", "react-dom"]) {
    const root = await lookup.nodeEntry(name);
    const file = root && viteFile(root.resolved.id);
    if (!root || !file) {
      peers[name] = null;
      continue;
    }
    peers[name] = lookup.resolveFileSync(file, root.source);
    const selectedManifest = await packageManifest(file);
    if (!selectedManifest) continue;
    const manifestFile = await lookup.paths.resolve(selectedManifest);
    peers[`${name}/package.json`] = manifestFile;
    const manifest: unknown = JSON.parse(
      await fs.readFile(manifestFile, "utf8"),
    );
    const exports =
      manifest && typeof manifest === "object" && "exports" in manifest
        ? manifest.exports
        : undefined;
    const names = new Set([
      `${name}/package.json`,
      ...(name === "react"
        ? ["react/jsx-runtime", "react/jsx-dev-runtime"]
        : ["react-dom/server"]),
    ]);
    if (exports && typeof exports === "object" && !Array.isArray(exports))
      for (const key of Object.keys(exports))
        if (key.startsWith("./")) names.add(name + key.slice(1));
    for (const specifier of names) {
      if (specifier.endsWith("/package.json")) continue;
      const result = await lookup.nodeEntry(specifier, manifestFile);
      const file = result && viteFile(result.resolved.id);
      peers[specifier] =
        result && file ? lookup.resolveFileSync(file, result.source) : null;
    }
  }
  return peers;
}

function missingPeer(name: string): Error {
  return Object.assign(
    new Error(`could not resolve ${name} under the selected dependency policy`),
    { code: "MODULE_NOT_FOUND" },
  );
}

async function packageManifest(file: string): Promise<string | undefined> {
  let directory = path.dirname(file);
  for (;;) {
    const candidate = path.join(directory, "package.json");
    try {
      await fs.access(candidate);
      return candidate;
    } catch (error) {
      if (!missingFile(error)) throw error;
    }
    const parent = path.dirname(directory);
    if (directory === parent) return;
    directory = parent;
  }
}
