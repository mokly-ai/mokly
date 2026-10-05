import type { ArtifactView } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import type { ResolvedConfig } from "../config/types.js";
import { validateDocumentHtml } from "../documents/safety.js";
import type { EntryMove } from "../review/moves/types.js";

import { adaptLinkControls } from "./link_controls.js";
import type { LogicalReferenceRecord } from "./logical_record_types.js";
import { rewriteMockLinks } from "./mock_links.js";

/** Adapt explicit controls and resolve links against this accepted registry. */
export function resolveDocumentLinks(
  outputs: Map<string, string>,
  entries: readonly ResolvedRegistryEntry[],
  config: ResolvedConfig,
  fragmentViews: ReadonlyMap<string, ArtifactView>,
  byId: ReadonlyMap<string, ResolvedRegistryEntry> = new Map(
    entries.map((entry) => [entry.path, entry]),
  ),
  moves: readonly EntryMove[] = [],
): readonly LogicalReferenceRecord[] {
  const records: LogicalReferenceRecord[] = [];
  for (const [route, original] of outputs) {
    const { colorScheme, viewport } = fragmentViews.get(route) ?? {
      colorScheme: "light",
      viewport: "desktop",
    };
    const linked = rewriteMockLinks(
      adaptLinkControls(original, route),
      route,
      viewport,
      colorScheme,
      byId,
      config.colorSchemes,
      moves,
    );
    const entry = byId.get(route.slice(0, route.lastIndexOf("/")));
    if (entry?.kind === "document")
      validateDocumentHtml(linked.content, entry.location);
    records.push(...linked.records);
    outputs.set(route, linked.content);
  }
  return records;
}
