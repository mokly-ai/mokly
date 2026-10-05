import {
  readCurrentPath,
  readBranchPointPath,
} from "../catalogue/path_values.js";

import type {
  ComponentVariantReview,
  ReviewResultV5,
} from "./component_types.js";
import { resultBranchPoints } from "./result_branch_points.js";
import { requireEqual, reviewInvalid } from "./result_helpers.js";

export function validateResultReferences(result: ReviewResultV5): void {
  for (const component of result.components)
    if (
      !component.variants.length &&
      component.after &&
      !result.components.some((parent) =>
        parent.variants.some(
          (variant) => variant.after?.path === component.after!.path,
        ),
      )
    )
      reviewInvalid("component variants are missing");
  const changed = new Set(
    result.changes
      .filter((entry) => entry.kind === "component")
      .map((entry) => (entry.after ?? entry.before)!.path),
  );
  const lookup = resultBranchPoints(result);
  const componentIdentity = (path: string, side: "before" | "after") =>
    lookup.usageComponent(
      side === "before" ? readBranchPointPath(path) : readCurrentPath(path),
      side,
    )?.entry.path;
  for (const affected of result.affectedConsumers) {
    if (!changed.has(affected.changedComponentId))
      reviewInvalid("affected evidence has no directly changed component");
    for (const evidence of affected.evidence) {
      const context = evidence.context;
      const owner = (
        context.kind === "component"
          ? lookup.usageComponent(
              evidence.side === "before"
                ? readBranchPointPath(context.entry.path)
                : readCurrentPath(context.entry.path),
              evidence.side,
            )
          : lookup.resolve(
              evidence.side === "before"
                ? {
                    kind: context.kind,
                    path: readBranchPointPath(context.entry.path),
                    side: "before",
                  }
                : {
                    kind: context.kind,
                    path: readCurrentPath(context.entry.path),
                    side: "after",
                  },
            )
      )?.entry.record;
      if (!owner?.[evidence.side])
        reviewInvalid("affected context side is missing");
      requireEqual(owner[evidence.side], context.entry);
      const views =
        context.kind === "screen" && "views" in owner
          ? owner.views
          : "variants" in owner && context.kind === "component"
            ? (
                lookup.resolve(
                  evidence.side === "before"
                    ? {
                        kind: "component",
                        path: readBranchPointPath(context.variantPath),
                        side: "before",
                      }
                    : {
                        kind: "component",
                        path: readCurrentPath(context.variantPath),
                        side: "after",
                      },
                )?.entry.record as ComponentVariantReview | undefined
              )?.views
            : undefined;
      if (
        !views?.some(
          (view) =>
            view.viewport === context.viewport &&
            view.colorScheme === context.colorScheme &&
            (view.state !== "added" || evidence.side === "after") &&
            (view.state !== "removed" || evidence.side === "before"),
        )
      )
        reviewInvalid("affected context view is missing");
      if (
        evidence.via.some(
          (edge) =>
            componentIdentity(edge.componentId, evidence.side) === undefined,
        )
      )
        reviewInvalid("unknown component in ownership chain");
      if (
        componentIdentity(evidence.via.at(-1)!.componentId, evidence.side) !==
        affected.changedComponentId
      )
        reviewInvalid("invalid ownership chain");
      if (
        affected.consumer.kind === "screen"
          ? context.kind !== "screen" || affected.consumer.path !== owner.path
          : affected.consumer.path === affected.changedComponentId ||
            (affected.consumer.path !== owner.path &&
              !evidence.via
                .slice(0, -1)
                .some(
                  (edge) =>
                    componentIdentity(edge.componentId, evidence.side) ===
                    affected.consumer.path,
                ))
      )
        reviewInvalid("affected consumer does not own this chain");
    }
  }
  for (const entry of result.changes)
    for (const reason of entry.reasons)
      if (
        reason.kind === "screen" &&
        !result.changes.some(
          (screen) =>
            screen.kind === "screen" &&
            [screen.before?.path, screen.after?.path].includes(
              reason.screenPath,
            ),
        )
      )
        reviewInvalid("use-case reason names a screen without a direct change");
}
