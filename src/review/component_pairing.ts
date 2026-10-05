import type { ManifestComponentVariant } from "@mokly/viewer";
import type {
  GeneratedComponentView,
  ReviewVariantAddress,
} from "@mokly/viewer/data";
import { isManifestComponentVariant } from "@mokly/viewer/data";

import type { ReviewEntry } from "./component_metadata.js";
import { groupedVariantPairs } from "./component_variant_pairs.js";
import type { EntryMove } from "./moves/types.js";
import { reviewViews } from "./views.js";

export function variantAddress(
  variant: ManifestComponentVariant,
): ReviewVariantAddress {
  return {
    path: variant.path,
    title: variant.title,
    ...(variant.description ? { description: variant.description } : {}),
    props: variant.props,
    suppliedSlots: variant.suppliedSlots,
  };
}
function viewPairs(
  before: readonly GeneratedComponentView[],
  after: readonly GeneratedComponentView[],
  moves: readonly EntryMove[] = [],
) {
  const mapped = new Map(
    moves.map((move) => [
      move.previousPath.toLowerCase(),
      move.path.toLowerCase(),
    ]),
  );
  const key = (view: GeneratedComponentView) =>
    `${view.variantPath?.toLowerCase() ?? ""}:${view.viewport === "mobile" ? 0 : 1}:${view.colorScheme === "light" ? 0 : 1}`;
  const bases = new Map(
    before.map((view) => [
      key(
        view.variantPath
          ? {
              ...view,
              variantPath:
                mapped.get(view.variantPath.toLowerCase()) ?? view.variantPath,
            }
          : view,
      ),
      view,
    ]),
  );
  const heads = new Map(after.map((view) => [key(view), view]));
  return [...new Set([...bases.keys(), ...heads.keys()])]
    .sort()
    .map((key) => ({ before: bases.get(key), after: heads.get(key) }));
}

/** Preserve original view routes while pairing component children through their accepted identities. */
export function entryViewPairs(
  pair: { before: ReviewEntry | undefined; after: ReviewEntry | undefined },
  beforeVariants: ReadonlyMap<string, ManifestComponentVariant>,
  afterVariants: ReadonlyMap<string, ManifestComponentVariant>,
  moves: readonly EntryMove[],
) {
  const before =
    pair.before?.kind === "component" &&
    !isManifestComponentVariant(pair.before)
      ? pair.before
      : undefined;
  const after =
    pair.after?.kind === "component" && !isManifestComponentVariant(pair.after)
      ? pair.after
      : undefined;
  const variants =
    before || after
      ? groupedVariantPairs(before, after, beforeVariants, afterVariants, moves)
      : undefined;
  return {
    variants,
    views: viewPairs(
      variants
        ? variants.flatMap((variant) =>
            variant.before ? reviewViews(variant.before) : [],
          )
        : pair.before
          ? reviewViews(pair.before)
          : [],
      variants
        ? variants.flatMap((variant) =>
            variant.after ? reviewViews(variant.after) : [],
          )
        : pair.after
          ? reviewViews(pair.after)
          : [],
      moves,
    ),
  };
}
