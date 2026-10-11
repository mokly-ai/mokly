import type { ArtifactView } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import type { ResolvedConfig } from "../config/types.js";
import { validateDocumentHtml } from "../documents/safety.js";
import type { EntryMove } from "../review/moves/types.js";
import { TextOffsetMap } from "../text_patches.js";

import type { BuildDiagnostic } from "./build_warnings.js";
import { adaptLinkControls } from "./link_controls.js";
import type { LogicalReferenceRecord } from "./logical_record_types.js";
import { rewriteMockLinks } from "./mock_links.js";

interface ResolvedDocumentLinks {
  readonly diagnostics: readonly BuildDiagnostic[];
  readonly records: readonly LogicalReferenceRecord[];
  readonly edits: ReadonlyMap<string, TextOffsetMap>;
}

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
): ResolvedDocumentLinks {
  const records: LogicalReferenceRecord[] = [];
  const diagnostics: BuildDiagnostic[] = [];
  const edits = new Map<string, TextOffsetMap>();
  for (const [route, original] of outputs) {
    const { colorScheme, viewport } = fragmentViews.get(route) ?? {
      colorScheme: "light",
      viewport: "desktop",
    };
    const adapted = adaptLinkControls(original, route);
    diagnostics.push(...adapted.diagnostics);
    const offsets = new TextOffsetMap(original);
    if (adapted.patches) offsets.apply(adapted.patches);
    const linked = rewriteMockLinks(
      adapted.html,
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
    offsets.apply(linked.patches);
    edits.set(route, offsets);
    outputs.set(route, linked.content);
  }
  return { diagnostics, records, edits };
}
