import fs from "node:fs";
import path from "node:path";

import type { Catalogue } from "@mokly/viewer/server";

import { adaptBrowseDocument } from "../browse/document_adapter.js";
import { locatePath } from "../config/file_locations.js";
import { GENERATED_DIRECTORY } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { capturePublicFiles } from "../export/public_files.js";
import { MANIFEST_NAME } from "../registry/manifest.js";
import { referencedRoutes } from "../review/asset_references.js";

/** Capture only the validated closure and in-memory generated documents. */
export async function copyPublicFiles(
  config: ResolvedConfig,
  catalogue: Catalogue,
  stage: string,
  _excludedRoots: readonly string[],
  generatedOutputs: ReadonlyMap<string, string>,
): Promise<void> {
  const root = path.join(stage, "static");
  const copied = new Set<string>();
  const generatedRoutes = new Set([...generatedOutputs.keys()]);
  const files = await capturePublicFiles(
    config,
    generatedOutputs,
    "assetClosure" in catalogue.manifest ? catalogue.manifest.assetClosure : [],
  );
  for (const [route, content] of files) {
    if (route === `${GENERATED_DIRECTORY}/${MANIFEST_NAME}`) continue;
    const target = path.join(root, route);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, content);
    copied.add(route);
  }
  for (const route of catalogueDocuments(catalogue)) {
    if (!copied.has(`${GENERATED_DIRECTORY}/${route}`))
      throw resourceError(route, "catalogue");
  }
  const documents = new Map<string, string>();
  for (const route of copied) {
    const file = await exportedFile(root, stage, route);
    if (!/\.(?:html?|css)$/i.test(route)) continue;
    const content = await fs.promises.readFile(file);
    const logical = route.startsWith(`${GENERATED_DIRECTORY}/`)
      ? route.slice(GENERATED_DIRECTORY.length + 1)
      : route;
    for (const resource of referencedRoutes(logical, content, undefined, {
      prefix: GENERATED_DIRECTORY,
      routes: generatedRoutes,
    })) {
      const target = generatedRoutes.has(resource)
        ? `${GENERATED_DIRECTORY}/${resource}`
        : resource;
      if (!copied.has(target)) throw resourceError(target, route);
      await exportedFile(root, stage, target, route);
    }
    if (/\.html?$/i.test(route) && generatedRoutes.has(logical))
      documents.set(
        route,
        adaptBrowseDocument(content.toString("utf8"), logical, catalogue),
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
