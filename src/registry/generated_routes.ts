import { generatedViews } from "@mokly/viewer/data";
import type { HistoricalManifest } from "@mokly/viewer/data";

/** Distinguish generated documents from authored nested HTML in a baseline. */
export function generatedManifestRoutes(
  manifest: HistoricalManifest,
): ReadonlySet<string> {
  return new Set([
    ...manifest.entries.flatMap((entry) => [
      ...(entry.kind === "page" ? [entry.route] : []),
      ...generatedViews(entry).map((view) => view.path),
    ]),
    ...("legacyPages" in manifest
      ? manifest.legacyPages.map((page) => page.route)
      : []),
  ]);
}
