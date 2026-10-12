/** Final component-link provenance and ranges in exhaustive output. */
import type { ComponentViewRecord } from "@mokly/viewer";

import { validateComponentRanges } from "../components/ranges.js";
import type { LinkedComponentStylesheet } from "../components/render.js";
import { finalizeComponentStylesheets } from "../components/stylesheet_provenance.js";

export function finalizeCompiledViews(
  outputs: Map<string, string>,
  componentViews: Map<string, ComponentViewRecord>,
  stylesheetLinks: ReadonlyMap<string, readonly LinkedComponentStylesheet[]>,
  mockupsDir: string,
): void {
  for (const [route, view] of componentViews) {
    const finalized = finalizeComponentStylesheets(
      outputs.get(route)!,
      view,
      route,
      mockupsDir,
      stylesheetLinks.get(route) ?? [],
    );
    outputs.set(route, finalized.html);
    validateComponentRanges(finalized.html, view.ranges);
    componentViews.set(route, finalized.view);
  }
}
