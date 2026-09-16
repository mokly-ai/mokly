/** Request-visible logical-fragment validation for served Browse routes. */

import fs from "node:fs";
import path from "node:path";

import type { ManifestComponent } from "@mokly/viewer";
import { generatedViews, isLogicalFragment } from "@mokly/viewer/data";
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
    return (await containsFragment(entry.route, fragment, config, documents))
      ? fragment
      : null;
  const screen = destinationScreen(entry, catalogue);
  if (!screen || !(await allViewsContain(screen, fragment, config, documents)))
    return null;
  return fragment;
}

/** Add the one canonical encoded fragment query to a route. */
export function withFragmentQuery(route: string, fragment?: string): string {
  return fragment === undefined
    ? route
    : `${route}?fragment=${encodeURIComponent(fragment)}`;
}

function destinationScreen(
  entry: ManifestEntry | undefined,
  catalogue: Catalogue,
): ManifestScreen | ManifestComponent | undefined {
  if (entry?.kind === "screen" || entry?.kind === "component") return entry;
  if (entry?.kind !== "use-case" || !entry.steps[0]) return undefined;
  const candidate = catalogue.byId.get(entry.steps[0].screenId);
  return candidate?.kind === "screen" ? candidate : undefined;
}

async function allViewsContain(
  screen: ManifestScreen | ManifestComponent,
  fragment: string,
  config: ResolvedConfig,
  documents?: DocumentService,
): Promise<boolean> {
  const routes = generatedViews(screen)
    .filter(
      (view) =>
        screen.kind !== "component" ||
        view.variantId === screen.variants[0]!.id,
    )
    .map((view) => view.path);
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
