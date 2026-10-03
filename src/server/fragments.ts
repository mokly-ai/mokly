/** Request-visible logical-fragment validation for served Browse routes. */

import type { ManifestComponentVariant } from "@mokly/viewer";
import {
  generatedViews,
  entryRoute,
  isLogicalFragment,
  isManifestComponentVariant,
} from "@mokly/viewer/data";
import type { ManifestEntry, ManifestScreen } from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";

import type { GeneratedFile } from "../build/generated_file.js";
import { extractHtmlReferences } from "../html_references.js";

import type { DocumentService } from "./demand/service.js";

/** Parse and cross-view validate the optional fragment query. */
export async function requestedFragment(
  url: URL,
  entry: ManifestEntry | undefined,
  catalogue: Catalogue,
  documents?: DocumentService,
  generatedOutputs?: ReadonlyMap<string, GeneratedFile>,
): Promise<string | null | undefined> {
  const values = url.searchParams.getAll("fragment");
  if (values.length === 0) return undefined;
  const fragment = values.length === 1 ? values[0] : undefined;
  if (!fragment || !isLogicalFragment(fragment)) return null;
  if (entry?.kind === "page")
    return (await containsFragment(
      entryRoute("page", entry.id),
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

function destinationScreen(
  entry: ManifestEntry | undefined,
  catalogue: Catalogue,
): ManifestScreen | ManifestComponentVariant | undefined {
  if (entry?.kind === "screen") return entry;
  if (entry?.kind === "component")
    return isManifestComponentVariant(entry)
      ? entry
      : (catalogue.hierarchy.variantsById.get(entry.id)?.[0] as
          ManifestComponentVariant | undefined);
  if (entry?.kind !== "use-case" || !entry.steps[0]) return undefined;
  const candidate = catalogue.byId.get(entry.steps[0].screenId);
  return candidate?.kind === "screen" ? candidate : undefined;
}

async function allViewsContain(
  screen: ManifestScreen | ManifestComponentVariant,
  fragment: string,
  documents?: DocumentService,
  generatedOutputs?: ReadonlyMap<string, GeneratedFile>,
): Promise<boolean> {
  const routes = generatedViews(screen).map((view) => view.path);
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
  generatedOutputs?: ReadonlyMap<string, GeneratedFile>,
): Promise<boolean> {
  try {
    if (documents)
      return extractHtmlReferences(
        (await documents.read(route)).html,
      ).anchors.has(fragment);
    const html = generatedOutputs?.get(route);
    return (
      html !== undefined &&
      extractHtmlReferences(Buffer.from(html).toString("utf8")).anchors.has(
        fragment,
      )
    );
  } catch {
    return false;
  }
}
