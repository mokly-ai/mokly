import {
  reviewInvalid,
  snapshotSidePath,
  snapshotViewPath,
} from "@mokly/viewer/data";
import type { ViewReview } from "@mokly/viewer/data";

import type { StylesheetReviewArtifact } from "./artifact_stylesheets.js";
import { referencedRoutes } from "./asset_references.js";
import { insertedStylesheetResources } from "./component_stylesheet_resources.js";
import { normalizeReviewPair } from "./ignore.js";

/** Check graph-backed evidence against the actual retained snapshots before publication. */
export function validateArtifactResources(
  artifact: StylesheetReviewArtifact,
): void {
  const views: {
    id: string;
    kind: "component" | "screen";
    view: ViewReview;
  }[] = [
    ...artifact.result.screens.flatMap((screen) =>
      screen.views.map((view) => ({
        id: screen.id,
        kind: "screen" as const,
        view,
      })),
    ),
    ...artifact.result.components.flatMap((entry) =>
      entry.variants.flatMap((variant) =>
        variant.views.map((view) => ({
          id: variant.id,
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
            item.kind,
            item.id,
            view.viewport,
            view.colorScheme,
          );
    const afterPath =
      view.state === "removed"
        ? undefined
        : snapshotViewPath(
            "after",
            item.kind,
            item.id,
            view.viewport,
            view.colorScheme,
          );
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
      const spans = artifact.insertedStylesheets?.get(root);
      const inserted = insertedStylesheetResources(
        side === "before" ? before : after,
        spans ? { insertedStylesheets: spans } : undefined,
        root.slice(prefix.length),
      );
      const pending = [
        ...referencedRoutes(
          root,
          side === "before" ? normalized.base : normalized.head,
          { resourceHints: false },
        ),
        ...inserted.map((route) => `${prefix}${route}`),
      ];
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
