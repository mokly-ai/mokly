/** Preserve Build's render order while yielding to foreground work between documents. */
import type { ComponentViewRecord } from "@mokly/viewer";
import {
  effectiveColorSchemes,
  VIEWPORTS,
  type ArtifactView,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import type { ResolvedConfig } from "../config/types.js";

import type { LoadedGraph } from "./load_graph.js";
import { renderFragments } from "./render.js";

export async function renderCooperatively(
  entries: readonly ResolvedRegistryEntry[],
  graph: LoadedGraph,
  config: ResolvedConfig,
  fragmentViews: Map<string, ArtifactView>,
  componentViews: Map<string, ComponentViewRecord>,
  checkpoint: () => Promise<void>,
): Promise<Map<string, string>> {
  const outputs = new Map<string, string>();
  const render = async (
    selection: NonNullable<Parameters<typeof renderFragments>[6]>,
  ) => {
    await checkpoint();
    for (const [route, content] of renderFragments(
      entries,
      graph.renderer,
      config,
      fragmentViews,
      graph.renderWithComponents,
      componentViews,
      selection,
    ))
      outputs.set(route, content);
  };
  const ordered = [
    ...entries.filter((entry) => entry.kind !== "page"),
    ...entries.filter((entry) => entry.kind === "page"),
  ];
  for (const entry of ordered) {
    if (entry.kind === "page") {
      await render({
        entryId: entry.id,
        viewport: "desktop",
        colorScheme: "light",
      });
    } else if (entry.kind === "screen" || entry.kind === "component") {
      for (const variantId of entry.kind === "component"
        ? entry.variants.map((variant) => variant.id)
        : [undefined])
        for (const viewport of VIEWPORTS)
          for (const colorScheme of effectiveColorSchemes(
            entry,
            config.colorSchemes,
          ))
            await render({
              entryId: entry.id,
              viewport,
              colorScheme,
              ...(variantId ? { variantId } : {}),
            });
    }
  }
  return outputs;
}
