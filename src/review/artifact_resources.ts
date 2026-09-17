import { reviewInvalid } from "@mokly/viewer/data";
import type { ReviewArtifact, ViewReview } from "@mokly/viewer/data";

import { referencedRoutes } from "./asset_references.js";
import { normalizeHistoricalDocument, normalizeReviewPair } from "./ignore.js";

/** Check graph-backed evidence against the actual retained snapshots before publication. */
export function validateArtifactResources(artifact: ReviewArtifact): void {
  const views: ViewReview[] = artifact.result.screens.flatMap(
    (screen) => screen.views,
  );
  if (artifact.result.schemaVersion === 3)
    views.push(
      ...artifact.result.components.flatMap((entry) =>
        entry.variants.flatMap((variant) => variant.views),
      ),
    );
  const edges = new Map<string, readonly string[]>();
  const text = (route: string): string => {
    const bytes = artifact.files.get(route);
    if (bytes === undefined)
      reviewInvalid(`resource evidence has no snapshot: ${route}`);
    return typeof bytes === "string"
      ? bytes
      : Buffer.from(bytes).toString("utf8");
  };
  for (const view of views) {
    const evidence = [
      ...(view.reasons ?? []),
      ...(view.excludedResources ?? []),
    ];
    if (!evidence.length) continue;
    const reachable = new Set<string>();
    const before = view.beforePath
      ? normalizeHistoricalDocument(text(view.beforePath))
      : undefined;
    const after = view.afterPath ? text(view.afterPath) : undefined;
    const normalized = normalizeReviewPair(
      before ?? after ?? "",
      after ?? before ?? "",
      view.afterPath ?? view.beforePath!,
    );
    for (const side of ["before", "after"] as const) {
      const root = view[`${side}Path`];
      if (!root) continue;
      const prefix = `snapshots/${side}/`;
      const pending = referencedRoutes(
        root,
        side === "before" ? normalized.base : normalized.head,
        { resourceHints: false },
      );
      const seen = new Set<string>();
      for (let index = 0; index < pending.length; index++) {
        const route = pending[index]!;
        if (seen.has(route)) continue;
        seen.add(route);
        if (!route.startsWith(prefix))
          reviewInvalid("resource evidence escaped its snapshot side");
        reachable.add(route.slice(prefix.length));
        let references = edges.get(route);
        if (!references) {
          references = referencedRoutes(route, text(route), {
            resourceHints: false,
          });
          edges.set(route, references);
        }
        pending.push(...references);
      }
    }
    for (const resource of evidence) {
      if (
        ![...reachable].some(
          (route) =>
            resource.path === route || resource.path.endsWith(`/${route}`),
        )
      )
        reviewInvalid(`resource evidence is not reachable: ${resource.path}`);
    }
  }
}
