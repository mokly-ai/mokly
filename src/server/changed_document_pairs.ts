/** Pair current view documents with their baseline paths and material-change eligibility. */
import type { ColorScheme, Viewport } from "@mokly/viewer";
import type { HistoricalManifest, ManifestV8 } from "@mokly/viewer/data";
import { entryRoute, VIEWPORTS } from "@mokly/viewer/data";

import { fragmentForView, unionColorSchemes } from "../review/screen_views.js";

export interface DocumentPair {
  base?: string;
  head: string;
  context: string;
  changed: boolean;
  view?: { id: string; viewport: Viewport; colorScheme: ColorScheme };
  pageId?: string;
}

export function documentPairs(
  manifest: ManifestV8,
  baseline: HistoricalManifest,
  changed: ReadonlySet<string>,
  documents: "all" | "pages",
): DocumentPair[] {
  const bases = new Map(baseline.entries.map((entry) => [entry.id, entry]));
  const pairs: DocumentPair[] = [];
  for (const screen of manifest.entries) {
    const baseEntry = bases.get(screen.id);
    if (screen.kind === "page") {
      const base =
        baseEntry?.kind === "page"
          ? entryRoute("page", baseEntry.id)
          : undefined;
      const head = entryRoute("page", screen.id);
      pairs.push({
        ...(base ? { base } : {}),
        head,
        context: head,
        pageId: screen.id,
        changed: base !== head || changed.has(head),
      });
      continue;
    }
    if (documents === "pages" || screen.kind !== "screen") continue;
    const base = baseEntry?.kind === "screen" ? baseEntry : undefined;
    for (const viewport of VIEWPORTS) {
      for (const scheme of unionColorSchemes(base, screen)) {
        const before = base
          ? fragmentForView(base, viewport, scheme)
          : undefined;
        const after = fragmentForView(screen, viewport, scheme);
        if (!after) continue;
        pairs.push({
          ...(before ? { base: before } : {}),
          head: after,
          context: `${entryRoute("screen", screen.id)} (${viewport}, ${scheme})`,
          changed: before !== after || changed.has(after),
          view: { id: screen.id, viewport, colorScheme: scheme },
        });
      }
    }
  }
  return pairs;
}
