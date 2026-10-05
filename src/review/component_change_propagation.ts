/** Preserve component implementation and use-case propagation after view comparison. */
import type {
  Manifest,
  ChangedEntry,
  ComponentReview,
} from "@mokly/viewer/data";

import {
  address,
  uniqueReasons,
  type ReviewEntry,
} from "./component_metadata.js";

export function propagateImplementations(
  actualImplementations: ReadonlySet<string>,
  impacting: Set<string>,
  components: readonly ComponentReview[],
  changes: ChangedEntry[],
): void {
  for (const id of actualImplementations) {
    impacting.add(id);
    const component = components.find((entry) => entry.path === id)!;
    const existing = changes.find(
      (entry) =>
        entry.kind === "component" &&
        (entry.after ?? entry.before)!.path === id,
    );
    if (existing)
      existing.reasons = uniqueReasons([
        ...existing.reasons,
        { kind: "material" },
      ]);
    else
      changes.push({
        kind: "component",
        ...(component.before ? { before: component.before } : {}),
        ...(component.after ? { after: component.after } : {}),
        reasons: [{ kind: "material" }],
      });
  }
}

export function propagateUseCases(
  pairs: readonly {
    before: ReviewEntry | undefined;
    after: ReviewEntry | undefined;
  }[],
  before: Manifest,
  after: Manifest,
  changes: ChangedEntry[],
  mapBefore: (path: string) => string = (path) => path,
): void {
  const changedScreens = new Set(
    changes
      .filter((entry) => entry.kind === "screen" && entry.reasons.length > 0)
      .map((entry) => (entry.after ?? entry.before)!.path),
  );
  for (const pair of pairs) {
    const entry = (pair.after ?? pair.before)!;
    if (entry.kind !== "use-case") continue;
    const screenIds = new Set(
      [pair.before, pair.after].flatMap((item, index) =>
        item?.kind === "use-case"
          ? item.steps.flatMap((step) =>
              (index === 0 ? before : after).entries.flatMap((screen) =>
                screen.kind === "screen" &&
                screen.path === step.screenPath &&
                changedScreens.has(
                  index === 0 ? mapBefore(screen.path) : screen.path,
                )
                  ? [index === 0 ? mapBefore(screen.path) : screen.path]
                  : [],
              ),
            )
          : [],
      ),
    );
    if (!screenIds.size) continue;
    const existing = changes.find(
      (change) =>
        change.kind === "use-case" &&
        (change.after ?? change.before)?.path === entry.path,
    );
    const reasons = uniqueReasons([
      ...(existing?.reasons ?? []),
      ...[...screenIds].map((id) => ({
        kind: "screen" as const,
        screenPath: id,
      })),
    ]);
    if (existing) existing.reasons = reasons;
    else
      changes.push({
        kind: "use-case",
        ...(pair.before ? { before: address(pair.before) } : {}),
        ...(pair.after ? { after: address(pair.after) } : {}),
        reasons,
      });
  }
}
