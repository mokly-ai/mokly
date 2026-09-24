/** Request-visible logical-fragment validation for served Browse routes. */

import type { ManifestComponent } from "@mokly/viewer";
import { generatedViews, isLogicalFragment } from "@mokly/viewer/data";
import type { ManifestEntry, ManifestScreen } from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";

import { extractHtmlReferences } from "../html_references.js";

import type { DocumentService } from "./demand/service.js";

/** Parse and cross-view validate the optional fragment query. */
export async function requestedFragment(
  url: URL,
  entry: ManifestEntry | undefined,
  catalogue: Catalogue,
  documents?: DocumentService,
  generatedOutputs?: ReadonlyMap<string, string>,
): Promise<string | null | undefined> {
  const values = url.searchParams.getAll("fragment");
  if (values.length === 0) return undefined;
  const fragment = values.length === 1 ? values[0] : undefined;
  if (!fragment || !isLogicalFragment(fragment)) return null;
  if (entry?.kind === "page")
    return (await containsFragment(
      entry.route,
      fragment,
      documents,
      generatedOutputs,
    ))
      ? fragment
      : null;
  const screen = destinationScreen(entry, catalogue);
  if (
    !screen ||
    !(await allViewsContain(screen, fragment, documents, generatedOutputs))
  )
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
  documents?: DocumentService,
  generatedOutputs?: ReadonlyMap<string, string>,
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
        containsFragment(route, fragment, documents, generatedOutputs),
      ),
    )
  ).every(Boolean);
}

async function containsFragment(
  route: string,
  fragment: string,
  documents?: DocumentService,
  generatedOutputs?: ReadonlyMap<string, string>,
): Promise<boolean> {
  try {
    if (documents)
      return extractHtmlReferences(
        (await documents.read(route)).html,
      ).anchors.has(fragment);
    const html = generatedOutputs?.get(route);
    return (
      html !== undefined && extractHtmlReferences(html).anchors.has(fragment)
    );
  } catch {
    return false;
  }
}
