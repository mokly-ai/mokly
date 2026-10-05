import type { ReviewResultV6 } from "./component_types.js";
import { requireEqual, reviewInvalid } from "./result_helpers.js";

export function validateResultReferences(result: ReviewResultV6): void {
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
  const componentIdentity = (path: string, side: "before" | "after") =>
    result.components.find((component) => component[side]?.path === path)?.path;
  for (const affected of result.affectedConsumers) {
    if (!changed.has(affected.changedComponentId))
      reviewInvalid("affected evidence has no directly changed component");
    for (const evidence of affected.evidence) {
      const context = evidence.context;
      const owner =
        context.kind === "screen"
          ? result.screens.find(
              (screen) => screen[evidence.side]?.path === context.entry.path,
            )
          : result.components.find(
              (component) =>
                component[evidence.side]?.path === context.entry.path,
            );
      if (!owner?.[evidence.side])
        reviewInvalid("affected context side is missing");
      requireEqual(owner[evidence.side], context.entry);
      const views =
        context.kind === "screen" && "views" in owner
          ? owner.views
          : "variants" in owner && context.kind === "component"
            ? result.components
                .flatMap((component) => component.variants)
                .find(
                  (variant) =>
                    variant[evidence.side]?.path === context.variantPath,
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
