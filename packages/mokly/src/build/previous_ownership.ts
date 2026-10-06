import fs from "node:fs";
import path from "node:path";

import { documentRoute, entryRoute, generatedViews } from "@mokly/viewer/data";

import { isResolvedEntryOrInventoriedSource } from "../config/entry_membership.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { documentResourceRoute } from "../documents/resource_paths.js";
import { MANIFEST_NAME, parseManifest } from "../registry/manifest.js";

interface PreviousOwnership {
  stamp: string;
  owners: ReadonlyMap<string, string>;
}
const inventories = new WeakMap<ResolvedConfig, PreviousOwnership>();

/** Retain exact output ownership across helper moves within the same catalogue. */
export function previousArtifactOwner(
  route: string,
  config: ResolvedConfig,
): string | undefined {
  const filename = path.join(config.mockupsDir, MANIFEST_NAME);
  try {
    const info = fs.lstatSync(filename, { bigint: true });
    if (!info.isFile()) return undefined;
    const stamp = [
      config.repoRoot,
      config.configPath,
      filename,
      info.dev,
      info.ino,
      info.size,
      info.mtimeNs,
      info.ctimeNs,
    ].join("\0");
    let inventory = inventories.get(config);
    if (inventory?.stamp !== stamp) {
      inventory = { stamp, owners: readOwners(filename, config) };
      inventories.set(config, inventory);
    }
    return inventory.owners.get(route);
  } catch {
    return undefined;
  }
}

function readOwners(
  filename: string,
  config: ResolvedConfig,
): ReadonlyMap<string, string> {
  const owners = new Map<string, string>();
  try {
    const manifest = parseManifest(
      JSON.parse(fs.readFileSync(filename, "utf8")),
    );
    const configSource = toPosixPath(
      path.relative(config.repoRoot, config.configPath),
    );
    const ownsConfig = manifest.sourceFiles.includes(configSource);
    for (const entry of manifest.entries) {
      const routes =
        entry.kind === "page"
          ? [entryRoute(entry.path)]
          : entry.kind === "document"
            ? entry.colorSchemes.map((scheme) =>
                documentRoute(entry.path, scheme),
              )
            : generatedViews(entry).map((view) => view.path);
      if (
        entry.kind === "document" &&
        (ownsConfig ||
          isResolvedEntryOrInventoriedSource(entry.sourcePath, config))
      )
        for (const resource of entry.resources) {
          const route = documentResourceRoute(entry, resource);
          if (route) owners.set(route, entry.sourcePath);
        }
      if (ownsConfig)
        for (const route of routes) owners.set(route, entry.sourcePath);
    }
  } catch {
    return owners;
  }
  return owners;
}
