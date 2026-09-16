/** Pair current view documents with their baseline paths and material-change eligibility. */
import type { ColorScheme, Viewport } from "@mokly/viewer";
import type { Manifest } from "@mokly/viewer/data";
import { VIEWPORTS } from "@mokly/viewer/data";

import { pageBaselines } from "../review/page_baselines.js";
import { fragmentForView, unionColorSchemes } from "../review/screen_views.js";

export interface DocumentPair {
  base?: string;
  head: string;
  context: string;
  changed: boolean;
  view?: { route: string; viewport: Viewport; colorScheme: ColorScheme };
}

export function documentPairs(
  manifest: Manifest,
  baseline: Manifest,
  changed: ReadonlySet<string>,
  documents: "all" | "pages",
): DocumentPair[] {
  const bases = new Map(baseline.entries.map((entry) => [entry.id, entry]));
  const pages = pageBaselines(manifest, baseline);
  const pairs: DocumentPair[] = [];
  for (const screen of manifest.entries) {
    const baseEntry = bases.get(screen.id);
    if (screen.kind === "page") {
      const base = pages.get(screen.id)?.route;
      pairs.push({
        ...(base ? { base } : {}),
        head: screen.route,
        context: screen.route,
        changed: base !== screen.route || changed.has(screen.route),
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
          context: `${screen.route} (${viewport}, ${scheme})`,
          changed: before !== after || changed.has(after),
          view: { route: screen.route, viewport, colorScheme: scheme },
        });
      }
    }
  }
  return pairs;
}
