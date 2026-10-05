import type { ReviewResultV5 } from "./component_types.js";
import { reviewInvalid } from "./result_helpers.js";

/** One historical identity cannot be paired twice or also advertised as removed. */
export function validateResultMoves(result: ReviewResultV5): void {
  const entries = [
    ...result.screens.map((entry) => ({ ...entry, kind: "screen" as const })),
    ...result.components.map((entry) => ({
      ...entry,
      kind: "component" as const,
    })),
    ...result.components.flatMap((component) =>
      component.variants.map((entry) => ({
        ...entry,
        kind: "component" as const,
      })),
    ),
    ...result.changes
      .filter((entry) => entry.kind === "use-case")
      .map((entry) => ({
        ...entry,
        path: (entry.after ?? entry.before)!.path,
      })),
  ];
  const previous = new Set<string>();
  const removed = new Set(
    entries
      .filter((entry) => !entry.after)
      .map((entry) => entry.path.toLowerCase()),
  );
  for (const entry of entries) {
    if (entry.previousPath === undefined) continue;
    const path = entry.previousPath.toLowerCase();
    if (previous.has(path)) reviewInvalid("previous paths must be unique");
    previous.add(path);
    if (removed.has(path))
      reviewInvalid("paired previous path cannot be removed");
    if (
      entries.some(
        (candidate) =>
          candidate.after &&
          candidate.kind === entry.kind &&
          candidate.path.toLowerCase() === path,
      )
    )
      reviewInvalid(
        "previousPath cannot name a current entry of the same kind",
      );
  }
}
