/** Request-visible logical-fragment validation for served Browse routes. */

import fs from "node:fs";
import path from "node:path";

import type { ManifestComponentVariant } from "@mokly/viewer";
import {
  generatedViews,
  entryRoute,
  isLogicalFragment,
  isManifestComponentVariant,
} from "@mokly/viewer/data";
import type { ManifestEntry, ManifestScreen } from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";

import { isPublicStaticFile } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import { extractHtmlReferences } from "../html_references.js";

import type { DocumentService } from "./demand/service.js";

/** Parse and cross-view validate the optional fragment query. */
export async function requestedFragment(
  url: URL,
  entry: ManifestEntry | undefined,
  catalogue: Catalogue,
  config: ResolvedConfig,
  documents?: DocumentService,
): Promise<string | null | undefined> {
  const values = url.searchParams.getAll("fragment");
  if (values.length === 0) return undefined;
  const fragment = values.length === 1 ? values[0] : undefined;
  if (!fragment || !isLogicalFragment(fragment)) return null;
  if (entry?.kind === "page")
    return (await containsFragment(
      entryRoute(entry.path),
      fragment,
      config,
      documents,
    ))
      ? fragment
      : null;
  const screen = destinationScreen(entry, catalogue);
  if (!screen || !(await allViewsContain(screen, fragment, config, documents)))
    return null;
  return fragment;
}

function destinationScreen(
  entry: ManifestEntry | undefined,
  catalogue: Catalogue,
): ManifestScreen | ManifestComponentVariant | undefined {
  if (entry?.kind === "screen") return entry;
  if (entry?.kind === "component")
    return isManifestComponentVariant(entry)
      ? entry
      : (catalogue.hierarchy.variantsByPath.get(entry.path)?.[0] as
          ManifestComponentVariant | undefined);
  if (entry?.kind !== "use-case" || !entry.steps[0]) return undefined;
  const candidate = catalogue.byPath.get(entry.steps[0].screenPath);
  return candidate?.kind === "screen" ? candidate : undefined;
}

async function allViewsContain(
  screen: ManifestScreen | ManifestComponentVariant,
  fragment: string,
  config: ResolvedConfig,
  documents?: DocumentService,
): Promise<boolean> {
  const routes = generatedViews(screen).map((view) => view.path);
  return (
    await Promise.all(
      routes.map((route) =>
        containsFragment(route, fragment, config, documents),
      ),
    )
  ).every(Boolean);
}

async function containsFragment(
  route: string,
  fragment: string,
  config: ResolvedConfig,
  documents?: DocumentService,
): Promise<boolean> {
  try {
    if (documents)
      return extractHtmlReferences(
        (await documents.read(route)).html,
      ).anchors.has(fragment);
    const file = path.join(config.mockupsDir, route);
    if (!isPublicStaticFile(file, config)) return false;
    return extractHtmlReferences(fs.readFileSync(file, "utf8")).anchors.has(
      fragment,
    );
  } catch {
    return false;
  }
}
