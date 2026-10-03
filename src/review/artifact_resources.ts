import {
  reviewInvalid,
  snapshotSidePath,
  snapshotViewPath,
} from "@mokly/viewer/data";
import type { ReviewArtifact, ViewReview } from "@mokly/viewer/data";

import { referencedRoutes } from "./asset_references.js";
import { normalizeReviewPair } from "./ignore.js";

/** Check graph-backed evidence against the actual retained snapshots before publication. */
export function validateArtifactResources(artifact: ReviewArtifact): void {
  const views: {
    path: string;
    kind: "component" | "screen";
    view: ViewReview;
  }[] = [
    ...artifact.result.screens.flatMap((screen) =>
      screen.views.map((view) => ({
        path: screen.path,
        kind: "screen" as const,
        view,
      })),
    ),
    ...artifact.result.components.flatMap((entry) =>
      entry.variants.flatMap((variant) =>
        variant.views.map((view) => ({
          path: variant.path,
          kind: "component" as const,
          view,
        })),
      ),
    ),
  ];
  const edges = new Map<string, readonly string[]>();
  const text = (route: string): string => {
    const bytes = artifact.files.get(route);
    if (bytes === undefined)
      reviewInvalid(`resource evidence has no snapshot: ${route}`);
    return typeof bytes === "string"
      ? bytes
      : Buffer.from(bytes).toString("utf8");
  };
  for (const item of views) {
    const { view } = item;
    const evidence = [
      ...(view.reasons ?? []),
      ...(view.excludedResources ?? []),
    ];
    if (!evidence.length) continue;
    const reachable = new Set<string>();
    const beforePath =
      view.state === "added"
        ? undefined
        : snapshotViewPath(
            "before",
            item.path,
            view.viewport,
            view.colorScheme,
          );
    const afterPath =
      view.state === "removed"
        ? undefined
        : snapshotViewPath("after", item.path, view.viewport, view.colorScheme);
    const before = beforePath ? text(beforePath) : undefined;
    const after = afterPath ? text(afterPath) : undefined;
    const normalized = normalizeReviewPair(
      before ?? after ?? "",
      after ?? before ?? "",
      afterPath ?? beforePath!,
    );
    for (const side of ["before", "after"] as const) {
      const root = side === "before" ? beforePath : afterPath;
      if (!root) continue;
      const prefix = snapshotSidePath(side);
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
