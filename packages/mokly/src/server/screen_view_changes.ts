import path from "node:path";

import { generatedViews } from "@mokly/viewer/data";
import type {
  HistoricalManifest,
  ManifestV8,
  ViewReview,
} from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import type { EntryMove } from "../review/moves/types.js";

export interface ScreenViewChanges {
  path: string;
  views: readonly Pick<ViewReview, "viewport" | "colorScheme" | "state">[];
}

/** Retain the completed material pass's per-view decisions without generating comparisons. */
export function screenViewChanges(
  current: ManifestV8,
  baseline: HistoricalManifest,
  config: ResolvedConfig,
  materialPaths: readonly string[],
  moves: readonly EntryMove[] = [],
): ScreenViewChanges[] {
  const changed = new Set(materialPaths);
  const prefix = toPosixPath(path.relative(config.repoRoot, config.mockupsDir));
  const moved = new Map(
    moves
      .filter((move) => move.kind === "screen")
      .map((move) => [move.previousPath.toLowerCase(), move.path]),
  );
  const before = new Map(
    baseline.entries
      .filter((entry) => entry.kind === "screen")
      .map((entry) => [
        (moved.get(entry.path.toLowerCase()) ?? entry.path).toLowerCase(),
        entry,
      ]),
  );
  const after = new Map(
    current.entries
      .filter((entry) => entry.kind === "screen")
      .map((entry) => [entry.path.toLowerCase(), entry]),
  );
  return [...new Set([...before.keys(), ...after.keys()])].sort().map((id) => {
    const previous = before.get(id),
      current = after.get(id);
    const left = previous ? generatedViews(previous) : [];
    const right = current ? generatedViews(current) : [];
    const views: ScreenViewChanges["views"] = (
      ["mobile", "desktop"] as const
    ).flatMap((viewport) =>
      (["light", "dark"] as const).flatMap((colorScheme) => {
        const before = left.find(
          (view) =>
            view.viewport === viewport && view.colorScheme === colorScheme,
        );
        const after = right.find(
          (view) =>
            view.viewport === viewport && view.colorScheme === colorScheme,
        );
        if (!before && !after) return [];
        return [
          {
            viewport,
            colorScheme,
            state: !after
              ? ("removed" as const)
              : !before
                ? ("added" as const)
                : changed.has(prefix ? `${prefix}/${after.path}` : after.path)
                  ? ("changed" as const)
                  : ("unchanged" as const),
          },
        ];
      }),
    );
    return { path: (current ?? previous)!.path, views };
  });
}
