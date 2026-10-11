/** Finalize stylesheet provenance and preserved offsets for compiled views. */
import type { ComponentViewRecord } from "@mokly/viewer";

import { validateComponentRanges } from "../components/ranges.js";
import type { LinkedComponentStylesheet } from "../components/render.js";
import { rebaseStyleOwnership } from "../components/style_ownership.js";
import { finalizeComponentStylesheets } from "../components/stylesheet_provenance.js";
import type { ResolvedConfig } from "../config/types.js";
import type { TextOffsetMap } from "../text_patches.js";

export function finalizeCompiledStylesheets(
  outputs: Map<string, string>,
  views: Map<string, ComponentViewRecord>,
  config: ResolvedConfig,
  links: ReadonlyMap<string, readonly LinkedComponentStylesheet[]>,
  edits: ReadonlyMap<string, TextOffsetMap>,
): void {
  for (const [route, view] of views) {
    const finalized = finalizeComponentStylesheets(
      outputs.get(route)!,
      view,
      route,
      config.mockupsDir,
      links.get(route) ?? [],
    );
    outputs.set(route, finalized.html);
    validateComponentRanges(finalized.html, view.ranges);
    views.set(route, {
      ...finalized.view,
      styles: rebaseStyleOwnership(edits.get(route)!, view.styles),
    });
  }
}
