import path from "node:path";

import type { Viewport, ComponentViewRecord } from "@mokly/viewer";
import { generatedViews, encodeUrlPath } from "@mokly/viewer/data";
import type { LogicalTarget } from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";

import { MoklyError } from "../errors.js";

/** Manifest-derived identity for one generated Browse document. */
export interface TrustedBrowseDocument {
  componentView?: ComponentViewRecord;
  colorScheme: "dark" | "light";
  sourcePath: string;
  viewport: Viewport;
}

/** Resolve a public route only when the current manifest owns it. */
export function trustedDocument(
  route: string,
  catalogue: Catalogue,
): TrustedBrowseDocument | undefined {
  for (const entry of catalogue.manifest.entries) {
    if (entry.kind === "page" && entry.route === route)
      return {
        colorScheme: "light",
        sourcePath: entry.sourcePath,
        viewport: "desktop",
      };
    for (const view of generatedViews(entry)) {
      if (view.path === route)
        return {
          colorScheme: view.colorScheme,
          sourcePath: entry.sourcePath,
          viewport: view.viewport,
          ...(view.usage ? { componentView: view.usage } : {}),
        };
    }
  }
  return undefined;
}

/** Derive the exact portable href expected for a trusted logical marker. */
export function expectedPortableHref(
  sourceRoute: string,
  source: TrustedBrowseDocument,
  destination: LogicalTarget,
  catalogue: Catalogue,
): string {
  const entry = catalogue.byId.get(destination.id);
  const screen =
    entry?.kind === "screen" || entry?.kind === "component"
      ? entry
      : entry?.kind === "use-case" && entry.steps[0]
        ? catalogue.byId.get(entry.steps[0].screenId)
        : undefined;
  if (
    entry?.kind !== "page" &&
    screen?.kind !== "screen" &&
    screen?.kind !== "component"
  ) {
    throw invalid(
      sourceRoute,
      `trusted marker links to an invalid id: ${destination.id}`,
    );
  }
  const views = screen
    ? generatedViews(screen).filter(
        (view) =>
          view.viewport === source.viewport &&
          (screen.kind !== "component" ||
            view.variantId === screen.variants[0]!.id),
      )
    : [];
  const targetRoute =
    entry?.kind === "page"
      ? entry.route
      : (views.find((view) => view.colorScheme === source.colorScheme)?.path ??
        views[0]!.path);
  const relative = path.posix.relative(
    path.posix.dirname(sourceRoute),
    targetRoute,
  );
  const encoded = encodeUrlPath(relative);
  const portable = encoded.startsWith(".") ? encoded : `./${encoded}`;
  return `${portable}${destination.fragment ? `#${destination.fragment}` : ""}`;
}

function invalid(route: string, message: string): MoklyError {
  return new MoklyError("build-invalid", `${route}: ${message}`);
}
