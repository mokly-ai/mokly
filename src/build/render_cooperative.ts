/** Preserve Build's render order while yielding to foreground work between documents. */
import type { ComponentViewRecord } from "@mokly/viewer";
import {
  effectiveColorSchemes,
  VIEWPORTS,
  type ArtifactView,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import type { LinkedComponentStylesheet } from "../components/render.js";
import { isComponentVariantDefinition } from "../components/types.js";
import type { PublicFilePolicy } from "../config/public_policy.js";
import type { ResolvedConfig } from "../config/types.js";

import type { BuildDiagnostic } from "./build_warnings.js";
import type { ResourceSeed } from "./html_links.js";
import type { LoadedGraph } from "./load_graph.js";
import type { PendingGeneratedFiles } from "./pending_generated.js";
import { renderFragments } from "./render.js";

export async function renderCooperatively(
  entries: readonly ResolvedRegistryEntry[],
  graph: LoadedGraph,
  config: ResolvedConfig,
  fragmentViews: Map<string, ArtifactView>,
  componentViews: Map<string, ComponentViewRecord>,
  checkpoint: () => Promise<void>,
  pending: PendingGeneratedFiles,
  policy: PublicFilePolicy,
  onWarning?: (warning: BuildDiagnostic) => void,
  stylesheetLinks?: Map<string, readonly LinkedComponentStylesheet[]>,
  resourceSeeds?: ResourceSeed[],
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
      { routes: graph.stylesheetRoutes, pending, policy },
      onWarning,
      stylesheetLinks,
      resourceSeeds,
    ))
      outputs.set(route, content);
  };
  const ordered = [
    ...entries.filter((entry) => entry.kind !== "page"),
    ...entries.filter((entry) => entry.kind === "page"),
  ];
  for (const entry of ordered) {
    if (entry.kind === "document") {
      for (const colorScheme of config.colorSchemes)
        await render({ entryId: entry.path, viewport: "desktop", colorScheme });
    } else if (entry.kind === "page") {
      await render({
        entryId: entry.path,
        viewport: "desktop",
        colorScheme: "light",
      });
    } else if (
      entry.kind === "screen" ||
      (entry.kind === "component" && isComponentVariantDefinition(entry))
    ) {
      for (const viewport of VIEWPORTS)
        for (const colorScheme of effectiveColorSchemes(
          entry,
          config.colorSchemes,
        ))
          await render({
            entryId: entry.path,
            viewport,
            colorScheme,
          });
    }
  }
  return outputs;
}
