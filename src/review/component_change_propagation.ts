/** Preserve component implementation and use-case propagation after view comparison. */
import type {
  Manifest,
  ChangedEntry,
  ComponentReview,
} from "@mokly/viewer/data";

import {
  address,
  uniqueReasons,
  type RoutedEntry,
} from "./component_metadata.js";

export function propagateImplementations(
  actualImplementations: ReadonlySet<string>,
  impacting: Set<string>,
  components: readonly ComponentReview[],
  changes: ChangedEntry[],
): void {
  for (const id of actualImplementations) {
    impacting.add(id);
    const component = components.find((entry) => entry.id === id)!;
    const existing = changes.find(
      (entry) =>
        entry.kind === "component" && (entry.after ?? entry.before)!.id === id,
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
    before: RoutedEntry | undefined;
    after: RoutedEntry | undefined;
  }[],
  before: Manifest,
  after: Manifest,
  changes: ChangedEntry[],
): void {
  const changedScreens = new Set(
    changes
      .filter((entry) => entry.kind === "screen")
      .flatMap((entry) =>
        [entry.before?.route, entry.after?.route].filter(
          (route): route is string => route !== undefined,
        ),
      ),
  );
  for (const pair of pairs) {
    const entry = (pair.after ?? pair.before)!;
    if (entry.kind !== "use-case") continue;
    const routes = new Set(
      [pair.before, pair.after].flatMap((item, index) =>
        item?.kind === "use-case"
          ? item.steps.flatMap((step) =>
              (index === 0 ? before : after).entries.flatMap((screen) =>
                screen.kind === "screen" &&
                screen.id === step.screenId &&
                changedScreens.has(screen.route)
                  ? [screen.route]
                  : [],
              ),
            )
          : [],
      ),
    );
    if (!routes.size) continue;
    const existing = changes.find(
      (change) =>
        change.kind === "use-case" &&
        (change.after ?? change.before)?.route === entry.route,
    );
    const reasons = uniqueReasons([
      ...(existing?.reasons ?? []),
      ...[...routes].map((route) => ({ kind: "screen" as const, route })),
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
