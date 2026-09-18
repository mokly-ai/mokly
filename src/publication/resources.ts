import fs from "node:fs";
import path from "node:path";

import type { Catalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../browse/document_adapter.js";
import { locatePath } from "../config/file_locations.js";
import { publicFileLocation } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { referencedRoutes } from "../review/asset_references.js";

import { publicationFiles, readPublicationFile } from "./files.js";

/** Materialize public aliases as regular files and validate their exported resources. */
export async function copyPublicFiles(
  config: ResolvedConfig,
  catalogue: Catalogue,
  stage: string,
  excludedRoots: readonly string[],
): Promise<void> {
  const root = path.join(stage, "static");
  const copied = new Set<string>();
  const files = await publicationFiles(
    config,
    config.mockupsDir,
    excludedRoots,
    true,
  );
  for (const file of files) {
    if (file.kind !== "file") continue;
    const location = publicFileLocation(file.path, config);
    if (!location) continue;
    const relative = location.relativePath;
    const target = path.join(root, relative);
    const content = await readPublicationFile(file, config.repoRoot);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, content);
    copied.add(relative);
  }
  for (const route of catalogueDocuments(catalogue)) {
    if (!copied.has(route)) throw resourceError(route, "catalogue");
  }
  const documents = new Map<string, string>();
  for (const route of copied) {
    const file = await exportedFile(root, stage, route);
    if (!/\.(?:html?|css)$/i.test(route)) continue;
    const content = await fs.promises.readFile(file);
    for (const resource of referencedRoutes(route, content)) {
      if (!copied.has(resource)) throw resourceError(resource, route);
      await exportedFile(root, stage, resource, route);
    }
    if (/\.html?$/i.test(route))
      documents.set(
        route,
        adaptBrowseDocument(content.toString("utf8"), route, catalogue),
      );
  }
  for (const [route, html] of documents)
    await fs.promises.writeFile(await exportedFile(root, stage, route), html);
}

/** Require current documents independently of the filesystem enumeration result. */
function catalogueDocuments(catalogue: Catalogue): readonly string[] {
  return catalogue.manifest.entries.flatMap((entry) =>
    entry.kind === "page"
      ? [entry.route]
      : entry.kind === "screen"
        ? [
            ...Object.values(entry.fragments),
            ...Object.values(entry.darkFragments ?? {}),
          ]
        : [],
  );
}

async function exportedFile(
  root: string,
  stage: string,
  route: string,
  source?: string,
): Promise<string> {
  const location = locatePath(path.join(root, route), root, stage);
  if (location) {
    try {
      if ((await fs.promises.lstat(location.physicalPath)).isFile())
        return location.physicalPath;
    } catch {
      throw resourceError(route, source);
    }
  }
  throw resourceError(route, source);
}

function resourceError(route: string, source?: string): Error {
  return new Error(
    `exported resource is unavailable: ${route}${source ? ` (referenced by ${source})` : ""}`,
  );
}
