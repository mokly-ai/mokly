import type { HistoricalManifest, ManifestPage } from "@mokly/viewer/data";

/** Historical document identity; sourcePath stays subject to baseline source protection. */
type PageBaseline = Pick<ManifestPage, "route" | "sourcePath">;

/** Attribute historical page artifacts to current IDs without synthesizing current metadata. */
export function pageBaselines(
  current: HistoricalManifest,
  baseline: HistoricalManifest,
): ReadonlyMap<string, PageBaseline> {
  const historical: ReadonlyMap<string, PageBaseline> =
    "sourceFiles" in baseline
      ? new Map(
          baseline.entries.flatMap((entry) =>
            entry.kind === "page" ? [[entry.id, entry]] : [],
          ),
        )
      : new Map(baseline.legacyPages.map((page) => [page.route, page]));
  const matches = new Map<string, PageBaseline>();
  for (const entry of current.entries) {
    if (entry.kind !== "page") continue;
    const match = historical.get(
      "sourceFiles" in baseline ? entry.id : entry.route,
    );
    if (match) matches.set(entry.id, match);
  }
  return matches;
}
