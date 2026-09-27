import { entryRoute } from "@mokly/viewer/data";
import type { HistoricalManifest, Manifest } from "@mokly/viewer/data";

/** Historical document identity; sourcePath stays subject to baseline source protection. */
export interface PageBaseline {
  artifactPath: string;
  sourcePath: string;
}

/** Attribute historical page artifacts to current IDs without synthesizing current metadata. */
export function pageBaselines(
  current: Manifest,
  baseline: HistoricalManifest,
): ReadonlyMap<string, PageBaseline> {
  const historical: ReadonlyMap<string, PageBaseline> =
    baseline.sourceFiles !== undefined
      ? new Map(
          baseline.entries.flatMap((entry) =>
            entry.kind === "page"
              ? [
                  [
                    entry.id,
                    {
                      artifactPath:
                        "artifactPath" in entry
                          ? entry.artifactPath
                          : entryRoute("page", entry.id),
                      sourcePath: entry.sourcePath,
                    },
                  ] as const,
                ]
              : [],
          ),
        )
      : new Map(
          (baseline.legacyPages ?? []).map((page) => [page.artifactPath, page]),
        );
  const matches = new Map<string, PageBaseline>();
  for (const entry of current.entries) {
    if (entry.kind !== "page") continue;
    const match = historical.get(
      baseline.sourceFiles !== undefined
        ? entry.id
        : entryRoute("page", entry.id),
    );
    if (match) matches.set(entry.id, match);
  }
  return matches;
}
